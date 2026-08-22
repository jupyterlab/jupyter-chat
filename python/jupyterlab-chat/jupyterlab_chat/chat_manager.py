# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""
Transport-agnostic chat lifecycle: model access and memory management.

``ChatManager`` gives server-side consumers (e.g. jupyter-ai-router, personas) a
single way to (1) observe chat lifecycle events, (2) retrieve a chat model by path
(or room id under RTC), and (3) rely on chat models being freed once inactive,
regardless of whether the backend is collaborative (``YChat``) or WebSocket-only
(``WsChatModel``).

The lifecycle event bus is delivered via Jupyter Events (schema in ``events.py``).
Every event carries the chat's stable id (``chat.get_id()``) as ``chat_id`` -- the
transport-neutral source of truth for correlating a chat across events and
transports. ``room_id`` is an RTC transport detail that stays internal to this
manager and to ``YChat`` (for path resolution); it is never emitted.

Under RTC, jupyter collaboration's room events are forwarded/parsed into the
generic schema; under WebSocket, the handler notifies the manager directly.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Optional

from tornado.ioloop import PeriodicCallback
from traitlets import Float
from traitlets.config import LoggingConfigurable

from .events import (
    CHAT_ROOM_EVENT_SCHEMA,
    CHAT_ROOM_EVENT_SCHEMA_ID,
    JUPYTER_COLLABORATION_EVENTS_URI,
    ChatEvent,
    ChatEventAction,
)
from .websocket_model import WsChatModel

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp

    from .models import BaseChatModel


class ChatManager(LoggingConfigurable):
    """
    Owns the set of live chat models and emits lifecycle events for them.

    Responsibilities:
      1. Event bus  -- ``observe_chats`` / emits ``opened|closed|deleted`` via Jupyter Events.
      2. Model access -- ``get`` (sync) / ``create`` (async get-or-create).
      3. Memory management -- frees a model after ``inactivity_timeout_s`` with no
         connected clients, or when its backing file is gone.

    Every emitted event carries the chat's stable ``chat_id`` (``model.get_id()``).
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
        consumers filter by ``action``. Every event carries ``chat_id`` -- the
        stable, transport-neutral chat id -- which consumers should use to
        correlate a chat. Use the client actions to (re)publish per-client state,
        such as a catch-up snapshot, when a new consumer joins an already-live chat.
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

    def _chat_id_for(self, path: str) -> Optional[str]:
        """The stable chat id for a live chat, or ``None`` if not currently live."""
        model = self._models.get(path)
        return model.get_id() if model is not None else None

    def on_client_connect(self, path: str, client_id: str) -> None:
        """Callback invoked upon WebSocket client connection. Emits an event.

        A live model is guaranteed here (the handler calls ``ws_open`` first), so
        the event always carries a ``chat_id``; the guard is purely defensive.
        """
        chat_id = self._chat_id_for(path)
        if chat_id is None:
            return
        self._emit_event(
            ChatEvent(
                path=path,
                action=ChatEventAction.CLIENT_CONNECTED,
                chat_id=chat_id,
                client_id=client_id,
            )
        )

    def on_client_disconnect(self, path: str, client_id: str) -> None:
        """Callback invoked upon WebSocket client disconnection. Emits an event.

        Fires before the model is freed, so the model is still live and the event
        always carries a ``chat_id``; the guard is purely defensive.
        """
        chat_id = self._chat_id_for(path)
        if chat_id is None:
            return
        self._emit_event(
            ChatEvent(
                path=path,
                action=ChatEventAction.CLIENT_DISCONNECTED,
                chat_id=chat_id,
                client_id=client_id,
            )
        )

    # ------------------------------------------------------------------
    # Responsibility 2 -- model access
    # ------------------------------------------------------------------
    def get(self, path: str) -> Optional["BaseChatModel"]:
        """Return the live model for a chat ``path``, or ``None`` if not live.

        Synchronous: an open chat is always already cached (we cache before
        emitting ``opened``). ``path`` is the canonical key stamped on every
        lifecycle event; a room id is an RTC transport detail and is never a
        valid key here.
        """
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
        for rid, p in list(self._room_to_path.items()):
            if p == path:
                del self._room_to_path[rid]
        if model is None:
            return None
        # Capture the stable chat id before disposing: close/delete events fire
        # after the model is freed, so this is the last chance to read it.
        chat_id = model.get_id()
        if isinstance(model, WsChatModel):
            model.dispose()
        self._emit_event(ChatEvent(path=path, action=action, chat_id=chat_id))
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
            self._emit_event(
                ChatEvent(
                    path=path,
                    action=ChatEventAction.OPENED,
                    chat_id=model.get_id(),
                )
            )
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
            # Resolve the YChat: `get_document` loads the file content into the
            # doc before returning, so `get_id()` reads the persisted metadata id
            # (never mints a premature one that could conflict with disk).
            model = await self._resolve_ychat(room)
            if model is None:
                # No usable chat without a resolved model; do not emit an
                # `opened` event that could not carry a chat_id.
                self.log.warning(
                    "Could not resolve YChat for room %s; skipping opened event",
                    room,
                )
                return
            self._models[path] = model
            self._emit_event(
                ChatEvent(
                    path=path,
                    action=ChatEventAction.OPENED,
                    chat_id=model.get_id(),
                )
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
                # `room_id` is an RTC transport detail kept internal to YChat.
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
