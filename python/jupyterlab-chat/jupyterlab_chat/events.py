# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""
Transport-agnostic chat lifecycle: event bus, model access, and memory management.

``ChatManager`` gives server-side consumers (e.g. jupyter-ai-router, personas) a
single way to (1) observe chat lifecycle events, (2) retrieve a chat model by path
(or room id under RTC), and (3) rely on chat models being freed once inactive,
regardless of whether the backend is collaborative (``YChat``) or WebSocket-only
(``WsChatModel``).

The lifecycle event bus is delivered via Jupyter Events. Under RTC, jupyter
collaboration's room events are forwarded/parsed into the generic schema below;
under WebSocket, the handler notifies the manager directly.

Out of scope for now (see tmp/chat-manager-design.md non-goals): message-level
events, ``reset``/``overwrite`` (hand-edited files), and a dedicated deletion
signal (deletion is detected by the inactivity poller checking the backing file).
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Optional

from tornado.ioloop import PeriodicCallback
from traitlets import Float
from traitlets.config import LoggingConfigurable

from .websocket_model import WsChatModel

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp

    from .models import BaseChatModel

#: Jupyter Events schema id for the generic (transport-agnostic) chat lifecycle bus.
CHAT_ROOM_EVENT_SCHEMA_ID = "https://schema.jupyter.org/jupyterlab_chat/room/v1"

#: jupyter_collaboration / JSD room event schema we forward from under RTC.
JUPYTER_COLLABORATION_EVENTS_URI = (
    "https://schema.jupyter.org/jupyter_collaboration/session/v1"
)

#: Inline schema (registered with the EventLogger at startup). Kept as a dict so
#: the package does not need to ship/locate a yaml resource.
CHAT_ROOM_EVENT_SCHEMA = {
    "$id": CHAT_ROOM_EVENT_SCHEMA_ID,
    "version": "1",
    "title": "Chat room and client events",
    "personal-data": True,
    "description": "Transport-agnostic chat room lifecycle and per-client connection events emitted by jupyterlab_chat.",
    "type": "object",
    "required": ["path", "action"],
    "properties": {
        "path": {
            "type": "string",
            "description": "Server-root-relative path of the .chat file (canonical id).",
        },
        "action": {
            "enum": [
                "opened",
                "closed",
                "deleted",
                "client_connected",
                "client_disconnected",
            ],
            "description": (
                "Chat event action. 'opened'/'closed'/'deleted' are room-level "
                "(fire once when the chat goes live / is freed / is deleted). "
                "'client_connected'/'client_disconnected' fire per client and "
                "carry 'client_id'."
            ),
        },
        "client_id": {
            "type": "string",
            "description": "Per-connection id; present only for the client_* actions.",
        },
        "room_id": {
            "type": "string",
            "description": "RTC room id ({format}:{type}:{file_id}); absent in WebSocket mode.",
        },
    },
    "additionalProperties": False,
}


class ChatEventAction(str, Enum):
    """Actions on the generic chat event bus."""

    OPENED = "opened"
    CLOSED = "closed"
    DELETED = "deleted"
    #: Fires for every client that connects to a chat (carries ``client_id``).
    CLIENT_CONNECTED = "client_connected"
    #: Fires for every client that disconnects from a chat (carries ``client_id``).
    CLIENT_DISCONNECTED = "client_disconnected"


@dataclass(frozen=True)
class ChatEvent:
    """A chat event. Emitted as JSON via Jupyter Events; this is the canonical
    shape (the registered schema mirrors it)."""

    path: str
    action: ChatEventAction
    room_id: Optional[str] = None
    #: Set only for the ``client_connected``/``client_disconnected`` actions.
    client_id: Optional[str] = None

    def to_data(self) -> dict:
        data: dict = {"path": self.path, "action": self.action.value}
        if self.room_id is not None:
            data["room_id"] = self.room_id
        if self.client_id is not None:
            data["client_id"] = self.client_id
        return data


class ChatManager(LoggingConfigurable):
    """
    Owns the set of live chat models and emits lifecycle events for them.

    Responsibilities:
      1. Event bus  -- ``observe_chats`` / emits ``opened|closed|deleted`` via Jupyter Events.
      2. Model access -- ``get`` (sync) / ``create`` (async get-or-create).
      3. Memory management -- frees a model after ``inactivity_timeout_s`` with no
         connected clients, or when its backing file is gone.
    """

    inactivity_timeout_s = Float(
        300.0, config=True, help="Free a chat model after this many seconds with no connected clients."
    )
    poll_interval_s = Float(
        60.0, config=True, help="How often to poll for inactive/deleted chats."
    )

    def __init__(self, serverapp: "ServerApp", rtc_enabled: bool = False, start_poller: bool = True, **kwargs):
        super().__init__(**kwargs)
        self._serverapp = serverapp
        self._settings = serverapp.web_app.settings
        self._event_logger = self._settings.get("event_logger")
        self._rtc_enabled = rtc_enabled

        self._models: dict[str, "BaseChatModel"] = {}
        self._room_to_path: dict[str, str] = {}
        self._last_active: dict[str, float] = {}

        # Single source of truth for the WS handler (supersedes the ad-hoc
        # ``ws_chat_models`` dict; kept under the same key for compatibility).
        self._settings["ws_chat_models"] = self._models

        self._register_schema()
        if rtc_enabled:
            self._wire_rtc_forwarding()

        self._poller = PeriodicCallback(self._poll, self.poll_interval_s * 1000)
        if start_poller:
            self._poller.start()

    @property
    def _root_dir(self) -> Path:
        return Path(self._settings.get("server_root_dir", ".")).expanduser().resolve()

    # ------------------------------------------------------------------
    # Responsibility 1 -- event bus
    # ------------------------------------------------------------------
    def _register_schema(self) -> None:
        if self._event_logger is None:
            self.log.warning("No event_logger in settings; chat events disabled.")
            return
        try:
            self._event_logger.register_event_schema(CHAT_ROOM_EVENT_SCHEMA)
        except Exception as e:  # pragma: no cover - defensive
            self.log.warning("Failed to register chat room event schema: %s", e)

    def observe_chats(self, callback: Callable) -> None:
        """Subscribe to chat events (wraps ``EventLogger.add_listener``).

        ``callback`` is ``async def (logger, schema_id, data)`` where ``data``
        matches :class:`ChatEvent`. The stream carries both room-level actions
        (``opened``/``closed``/``deleted``) and per-client actions
        (``client_connected``/``client_disconnected``, which carry ``client_id``);
        consumers filter by ``action``. Use the client actions to (re)publish
        per-client state, such as a catch-up snapshot, when a new consumer joins
        an already-live chat.
        """
        if self._event_logger is None:
            return
        self._event_logger.add_listener(
            schema_id=CHAT_ROOM_EVENT_SCHEMA_ID, listener=callback
        )

    def _emit_event(self, event: ChatEvent) -> None:
        if self._event_logger is None:
            return
        try:
            self._event_logger.emit(
                schema_id=CHAT_ROOM_EVENT_SCHEMA_ID, data=event.to_data()
            )
        except Exception as e:  # pragma: no cover - defensive
            self.log.warning("Failed to emit chat event %s: %s", event, e)

    def _room_id_for(self, path: str) -> Optional[str]:
        return next(
            (rid for rid, p in self._room_to_path.items() if p == path), None
        )

    def on_client_connect(self, path: str, client_id: str) -> None:
        """Callback invoked upon WebSocket client connection. Emits an event."""
        self._emit_event(
            ChatEvent(
                path=path,
                action=ChatEventAction.CLIENT_CONNECTED,
                room_id=self._room_id_for(path),
                client_id=client_id,
            )
        )

    def on_client_disconnect(self, path: str, client_id: str) -> None:
        """Callback invoked upon WebSocket client disconnection. Emits an event."""
        self._emit_event(
            ChatEvent(
                path=path,
                action=ChatEventAction.CLIENT_DISCONNECTED,
                room_id=self._room_id_for(path),
                client_id=client_id,
            )
        )

    # ------------------------------------------------------------------
    # Responsibility 2 -- model access
    # ------------------------------------------------------------------
    def get(self, query: str) -> Optional["BaseChatModel"]:
        """Return the live model for a path (or a room id, when RTC is available).

        Synchronous: an open chat is always already cached (we cache before
        emitting ``opened``). Returns ``None`` if the chat is not currently live.
        """
        path = self._resolve_path(query)
        if path is None:
            return None
        return self._models.get(path)

    async def create(self, path: str) -> Optional["BaseChatModel"]:
        """Async get-or-create. Resolves+caches if already open, otherwise
        instantiates the model (WS: ``WsChatModel`` + ``load_from_file``; RTC:
        resolve the ``YChat``). Creating an empty chat when the file is missing
        is expected behavior for WS.
        """
        model = self._models.get(path)
        if model is not None:
            return model
        if self._rtc_enabled:
            return await self._resolve_ychat_by_path(path)
        return self._get_or_create_ws(path)

    def _resolve_path(self, query: str) -> Optional[str]:
        if query in self._models:
            return query
        if query in self._room_to_path:
            return self._room_to_path[query]
        # A room id ("{fmt}:{type}:{id}") is only meaningful under RTC, and only
        # resolvable if we have seen its ``opened`` event. We do not depend on a
        # fileIdManager here; an unknown room id resolves to None.
        if _looks_like_room_id(query):
            return None
        return query  # treat as a path

    # ------------------------------------------------------------------
    # Responsibility 3 -- memory management
    # ------------------------------------------------------------------
    def _poll(self) -> None:
        now = time.time()
        for path in list(self._models.keys()):
            model = self._models.get(path)
            if model is None:
                continue
            # Deletion: the backing file is gone (via ContentsManager/filesystem).
            # Use the model's live path so an in-band move (which updates the
            # model's tracked path) is not mistaken for a deletion.
            if not (self._root_dir / model.get_path()).exists():
                self._free(path, ChatEventAction.DELETED)
                continue
            # Inactivity: only applies to WS models we own the memory for. A
            # connected client keeps the chat alive.
            if isinstance(model, WsChatModel):
                if model.handlers:
                    self._last_active[path] = now
                elif now - self._last_active.get(path, now) > self.inactivity_timeout_s:
                    self._free(path, ChatEventAction.CLOSED)

    def _free(self, path: str, action: ChatEventAction) -> Optional["BaseChatModel"]:
        model = self._models.pop(path, None)
        self._last_active.pop(path, None)
        if isinstance(model, WsChatModel):
            model.dispose()
        room_id = None
        for rid, p in list(self._room_to_path.items()):
            if p == path:
                room_id = rid
                del self._room_to_path[rid]
        if model is not None:
            self._emit_event(ChatEvent(path=path, action=action, room_id=room_id))
        return model

    def stop(self) -> None:
        if getattr(self, "_poller", None) is not None:
            self._poller.stop()

    # ------------------------------------------------------------------
    # WebSocket transport hooks (called by WSChatHandler)
    # ------------------------------------------------------------------
    def ws_open(self, path: str) -> "WsChatModel":
        """First/any client connecting to ``path``: get-or-create the model and
        (on first creation) emit ``opened``."""
        model = self._get_or_create_ws(path)
        self._last_active[path] = time.time()
        return model

    def ws_activity(self, path: str) -> None:
        self._last_active[path] = time.time()

    def ws_client_gone(self, path: str) -> None:
        # The last client for this chat has disconnected. Free the model now
        # unless a server-side writer (e.g. an AI persona still producing a
        # reply) is keeping it alive, in which case the poller reclaims it once
        # the writer stops. Freeing here -- rather than reloading from disk on the
        # next open -- is what keeps a reopened chat consistent without having to
        # handle out-of-band file changes.
        self._last_active[path] = time.time()
        if not self._has_active_writers(path):
            self._free(path, ChatEventAction.CLOSED)

    def _has_active_writers(self, path: str) -> bool:
        """Whether a server-side writer is keeping this chat alive.

        A "writer" is an AI persona (or other server-side producer) that is still
        working on a reply and would be orphaned if the model were freed. The
        server-side writing API is not on this branch yet (see
        jupyterlab/jupyter-chat#497); until it lands there are no server-side
        writers, so a chat is freed as soon as its last client disconnects.
        """
        return False

    def _get_or_create_ws(self, path: str) -> "WsChatModel":
        model = self._models.get(path)
        if model is None:
            model = WsChatModel(
                path=path,
                root_dir=self._root_dir,
                event_logger=self._event_logger,
            )
            model.load_from_file()
            self._models[path] = model
            self._last_active[path] = time.time()
            self._emit_event(ChatEvent(path=path, action=ChatEventAction.OPENED))
        # A cached model is the live in-memory session: reuse it verbatim. We do
        # not reload from disk (out-of-band file changes are unsupported) so that
        # any attached server-side state, such as AI personas, is preserved when a
        # client reconnects.
        return model  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # RTC forwarding (best-effort; not exercised without jupyter_collaboration)
    # ------------------------------------------------------------------
    def _wire_rtc_forwarding(self) -> None:
        if self._event_logger is None:
            return
        try:
            self._event_logger.add_listener(
                schema_id=JUPYTER_COLLABORATION_EVENTS_URI,
                listener=self._on_rtc_room_event,
            )
        except Exception as e:  # pragma: no cover - depends on RTC install
            self.log.warning("Could not attach RTC room-event forwarder: %s", e)

    async def _on_rtc_room_event(self, logger, schema_id: str, data: dict) -> None:
        room = data.get("room", "") or ""
        path = data.get("path")
        action = data.get("action")
        parts = room.split(":")
        # Chat rooms only: {file_format}:{file_type}:{file_id} with file_type == "chat".
        if len(parts) < 2 or parts[1] != "chat" or not path:
            return
        if action == "initialize":
            self._room_to_path[room] = path
            self._last_active[path] = time.time()
            model = await self._resolve_ychat(room)
            if model is not None:
                self._models[path] = model
            self._emit_event(
                ChatEvent(path=path, action=ChatEventAction.OPENED, room_id=room)
            )
        elif action == "clean":
            self._free(path, ChatEventAction.CLOSED)

    async def _resolve_ychat(self, room_id: str):
        """Resolve the ``YChat`` for a room via jupyter_collaboration. Mirrors
        jupyter-ai-router's approach; guarded because the APIs only exist when an
        RTC provider is installed."""
        try:
            collaboration = self._settings["jupyter_server_ydoc"]
            model = await collaboration.get_document(room_id=room_id, copy=False)
            if model is not None:
                # Record the room id (so get_path() can recover the file id) and
                # the initial path, both taken from the room lifecycle event
                # (self._room_to_path is populated from that event's `path`).
                model.room_id = room_id
                model.initial_path = self._room_to_path.get(room_id)
            return model
        except Exception as e:  # pragma: no cover - depends on RTC install
            self.log.warning("Could not resolve YChat for room %s: %s", room_id, e)
            return None

    async def _resolve_ychat_by_path(self, path: str):
        room_id = next(
            (rid for rid, p in self._room_to_path.items() if p == path), None
        )
        if room_id is None:
            return None
        model = await self._resolve_ychat(room_id)
        if model is not None:
            self._models[path] = model
        return model


def _looks_like_room_id(query: str) -> bool:
    """Heuristic: RTC room ids have the form ``{file_format}:{file_type}:{file_id}``.
    A ``.chat`` path never contains ':' on the platforms we support."""
    return query.count(":") >= 2
