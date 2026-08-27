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

        # Live chat models keyed by their stable chat id (``chat.get_id()``) --
        # the only stable identifier of a chat (paths change on rename; room ids
        # exist only under RTC). ``_last_activity_by_id`` is keyed the same way.
        self._chats_by_id: dict[str, "BaseChatModel"] = {}
        self._last_activity_by_id: dict[str, float] = {}

        # Exposed for server-side consumers under the ``chats_by_id`` settings key
        # (same dict object as ``_chats_by_id``), keyed by the stable chat id.
        self._settings["chats_by_id"] = self._chats_by_id

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

    def on_client_connect(self, path: str, client_id: str, chat_id: str) -> None:
        """Callback invoked upon WebSocket client connection. Emits an event.

        ``chat_id`` is supplied by the caller (the WS handler, which already holds
        the model), so the event always carries the chat's stable id.
        """
        self._emit_event(
            ChatEvent(
                path=path,
                action=ChatEventAction.CLIENT_CONNECTED,
                chat_id=chat_id,
                client_id=client_id,
            )
        )

    def on_client_disconnect(self, path: str, client_id: str, chat_id: str) -> None:
        """Callback invoked upon WebSocket client disconnection. Emits an event.

        ``chat_id`` is supplied by the caller (the WS handler still holds the live
        model at disconnect time), so the event always carries the chat's id.
        """
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
    def get(self, chat_id: str) -> Optional["BaseChatModel"]:
        """Return the live model for a stable ``chat_id`` (``chat.get_id()``), or
        ``None`` if that chat is not currently live.

        The chat id is the only stable key; it is stamped on every lifecycle
        event, so consumers already have it. (Paths change on rename and room ids
        exist only under RTC, so neither is a reliable key.)
        """
        return self._chats_by_id.get(chat_id)

    async def create(self, path: str) -> Optional["BaseChatModel"]:
        """Async get-or-create by ``path`` (the WS connection parameter).

        WS: get-or-create a ``WsChatModel`` (loading from disk; creating an empty
        chat when the file is missing is expected). RTC: an ``opened`` room event
        creates and caches the ``YChat``, so this returns an already-live model
        and does not create one on demand.
        """
        if self._rtc_enabled:
            existing = self._model_for_path(path)
            return existing
        return self._get_or_create_ws(path)

    def _model_for_path(self, path: str) -> Optional["BaseChatModel"]:
        """Find the live model whose current path is ``path`` (linear scan over
        the handful of live chats). Uses ``get_path()`` so a renamed chat is
        matched by its current path, never a stale key."""
        return next(
            (m for m in self._chats_by_id.values() if m.get_path() == path), None
        )

    # ------------------------------------------------------------------
    # Responsibility 3 -- memory management
    # ------------------------------------------------------------------
    def _poll(self) -> None:
        now = time.time()
        for chat_id in list(self._chats_by_id.keys()):
            model = self._chats_by_id.get(chat_id)
            if model is None:
                continue
            # Deletion: the backing file is gone (via ContentsManager/filesystem).
            # Use the model's live path so an in-band move (which updates the
            # model's tracked path) is not mistaken for a deletion.
            if not (self._root_dir / model.get_path()).exists():
                self._free(chat_id, ChatEventAction.DELETED)
                continue
            # Inactivity: only applies to WS models we own the memory for. A
            # connected client -- or an open ``keep_alive()`` context (e.g. a
            # persona still writing) -- keeps the chat alive.
            if isinstance(model, WsChatModel):
                if model.handlers or model.is_kept_alive:
                    self._last_activity_by_id[chat_id] = now
                elif now - self._last_activity_by_id.get(chat_id, now) > self.inactivity_timeout_s:
                    self._free(chat_id, ChatEventAction.CLOSED)

    def _free(self, chat_id: str, action: ChatEventAction) -> Optional["BaseChatModel"]:
        model = self._chats_by_id.pop(chat_id, None)
        self._last_activity_by_id.pop(chat_id, None)
        if model is None:
            return None
        if isinstance(model, WsChatModel):
            model.dispose()
        # The event carries the model's current path (for display/discovery) and
        # its stable chat id (the key we just freed).
        self._emit_event(
            ChatEvent(path=model.get_path(), action=action, chat_id=chat_id)
        )
        return model

    def stop(self) -> None:
        if getattr(self, "_poller", None) is not None:
            self._poller.stop()

    # ------------------------------------------------------------------
    # WebSocket transport hooks (called by WSChatHandler)
    # ------------------------------------------------------------------
    def ws_open(self, path: str) -> "WsChatModel":
        """First/any client connecting to ``path``: get-or-create the model and
        (on first creation) emit ``opened``. Returns the model; the caller reads
        ``model.get_id()`` for the stable chat id."""
        model = self._get_or_create_ws(path)
        self._last_activity_by_id[model.get_id()] = time.time()
        return model

    def ws_activity(self, chat_id: str) -> None:
        self._last_activity_by_id[chat_id] = time.time()

    def ws_client_gone(self, chat_id: str) -> None:
        # The last client for this chat has disconnected. Free the model now
        # unless a server-side writer (e.g. an AI persona still producing a
        # reply) is keeping it alive, in which case the poller reclaims it once
        # the writer stops. Freeing here -- rather than reloading from disk on the
        # next open -- is what keeps a reopened chat consistent without having to
        # handle out-of-band file changes.
        self._last_activity_by_id[chat_id] = time.time()
        if not self._has_active_writers(chat_id):
            self._free(chat_id, ChatEventAction.CLOSED)

    def _has_active_writers(self, chat_id: str) -> bool:
        """Whether a server-side producer is keeping this chat alive.

        A chat is kept alive while any :meth:`WsChatModel.keep_alive` context is
        open -- for example an AI persona still producing a reply after every
        client has disconnected. While kept alive the model is not freed when the
        last client leaves; the poller reclaims it once no ``keep_alive`` context
        remains and no clients are connected.
        """
        model = self._chats_by_id.get(chat_id)
        return isinstance(model, WsChatModel) and model.is_kept_alive

    def _get_or_create_ws(self, path: str) -> "WsChatModel":
        # Reuse the live model for this path if one exists (matched by current
        # path, so a renamed chat is still found). A cached model is the live
        # in-memory session: reuse it verbatim -- we do not reload from disk
        # (out-of-band file changes are unsupported) so attached server-side
        # state, such as AI personas, is preserved across reconnects.
        existing = self._model_for_path(path)
        if isinstance(existing, WsChatModel):
            return existing
        model = WsChatModel(
            path=path,
            root_dir=self._root_dir,
            event_logger=self._event_logger,
        )
        model.load_from_file()
        chat_id = model.get_id()
        self._chats_by_id[chat_id] = model
        self._last_activity_by_id[chat_id] = time.time()
        self._emit_event(
            ChatEvent(
                path=path,
                action=ChatEventAction.OPENED,
                chat_id=chat_id,
            )
        )
        return model

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
            # Resolve the YChat: `get_document` loads the file content into the
            # doc before returning, so `get_id()` reads the persisted metadata id
            # (never mints a premature one that could conflict with disk).
            model = await self._resolve_ychat(room, initial_path=path)
            if model is None:
                # No usable chat without a resolved model; do not emit an
                # `opened` event that could not carry a chat_id.
                self.log.warning(
                    "Could not resolve YChat for room %s; skipping opened event",
                    room,
                )
                return
            chat_id = model.get_id()
            self._chats_by_id[chat_id] = model
            self._last_activity_by_id[chat_id] = time.time()
            self._emit_event(
                ChatEvent(
                    path=path,
                    action=ChatEventAction.OPENED,
                    chat_id=chat_id,
                )
            )
        elif action == "clean":
            model = self._model_for_path(path)
            if model is not None:
                self._free(model.get_id(), ChatEventAction.CLOSED)

    async def _resolve_ychat(self, room_id: str, initial_path: str):
        """Resolve the ``YChat`` for a room via jupyter_collaboration. Mirrors
        jupyter-ai-router's approach; guarded because the APIs only exist when an
        RTC provider is installed."""
        try:
            collaboration = self._settings["jupyter_server_ydoc"]
            model = await collaboration.get_document(room_id=room_id, copy=False)
            if model is not None:
                # Record the room id (so get_path() can recover the file id) and
                # the initial path, both taken from the room lifecycle event.
                # `room_id` is an RTC transport detail kept internal to YChat.
                model.room_id = room_id
                model.initial_path = initial_path
            return model
        except Exception as e:  # pragma: no cover - depends on RTC install
            self.log.warning("Could not resolve YChat for room %s: %s", room_id, e)
            return None
