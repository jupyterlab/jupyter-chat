# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import logging
import os
import time
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable, Dict, Iterator, List, Optional, Union

from jupyter_events import EventLogger
from jupyter_server.services.contents.manager import ContentsManager
from tornado import websocket

from .ws_messages import (
    ServerMessageMessage,
    ServerMetadataMessage,
    ServerUsersMessage,
    ServerWritingMessage,
    to_wire,
)
from .models import (
    BaseChatModel,
    ChatMessageAction,
    ChatMessageEvent,
    FileAttachment,
    Message,
    MessageObserver,
    MessageObserverCallback,
    NewMessage,
    NotebookAttachment,
    User,
    message_asdict_factory,
)

_log = logging.getLogger(__name__)

#: Jupyter Server ContentsManager event schema id. The manager emits a
#: ``rename`` action (with ``source_path`` and ``path``) on in-band
#: moves/renames.
CONTENTS_EVENT_SCHEMA_ID = ContentsManager.event_schema_id


class WsChatModel(BaseChatModel):
    """
    In-memory state for a single .chat file in WebSocket mode.

    Implements BaseChatModel so trigger actions and bots work identically
    to the collaborative (YChat) backend.
    """

    def __init__(
        self,
        path: str,
        root_dir: Path,
        event_logger: Optional[EventLogger] = None,
    ):
        self.path = path
        self.root_dir = root_dir
        self.handlers: Dict[str, websocket.WebSocketHandler] = {}
        # Number of open ``keep_alive()`` contexts. While > 0 the ChatManager
        # will not free this model even with no connected clients (see
        # ``keep_alive`` / ``is_kept_alive``). An int -- not a bool -- so nested
        # or concurrent contexts each hold the model alive until the last exits.
        self._keep_alive_depth = 0
        self._messages: list[dict] = []
        self._indexes_by_id: dict[str, int] = {}
        self._users: Dict[str, dict] = {}
        self._attachments: Dict[str, dict] = {}
        self._metadata: Dict[str, object] = {}
        self._message_observers: List[MessageObserverCallback] = []

        # Track in-band moves: a rename via the ContentsManager updates our
        # tracked path, so subsequent saves go to the file's new location. This
        # does not observe out-of-band moves (e.g. `mv` in a terminal), which do
        # not go through the ContentsManager.
        self._event_logger = event_logger
        if event_logger is not None:
            event_logger.add_listener(
                schema_id=CONTENTS_EVENT_SCHEMA_ID,
                listener=self._on_contents_event,
            )

    # ------------------------------------------------------------------
    # Room-level helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "messages": self._messages,
            "users": self._users,
            "attachments": self._attachments,
            "metadata": self._metadata,
        }

    def load_from_file(self) -> None:
        full_path = self.root_dir / self.path
        try:
            with open(full_path) as f:
                content = json.load(f)
            self._messages = content.get("messages", [])
            self._users = content.get("users", {})
            self._attachments = content.get("attachments", {})
            self._metadata = content.get("metadata", {})
        except (FileNotFoundError, json.JSONDecodeError):
            self._metadata = {}
        # A stable id lives in the chat file's metadata (same as the
        # collaborative model). Generate one if the file has none yet; it is
        # persisted on the next save.
        self._metadata.setdefault("id", uuid.uuid4().hex)
        self._indexes_by_id = {m["id"]: i for i, m in enumerate(self._messages) if "id" in m}

    def save(self) -> None:
        full_path = self.root_dir / self.path
        with open(full_path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    def broadcast(self, message: str) -> None:
        for handler in list(self.handlers.values()):
            try:
                handler.write_message(message)
            except websocket.WebSocketClosedError:
                pass

    def broadcast_writing_status(self, user: User, status=None) -> None:
        """Broadcast an ephemeral writing status for ``user`` to all clients.

        Not persisted to the ``.chat`` file. ``user`` is a :class:`User`;
        ``status`` is ``None`` (stopped) or a mapping with optional
        ``messageID``/``typingIndicator``. The full user object is included so
        recipients can display the writer (and tell bots from humans via
        ``user.bot``) without having seen a message from them.
        """
        active = status is not None
        status = status or {}
        self.broadcast(
            to_wire(
                ServerWritingMessage(
                    user=asdict(user),
                    state=active,
                    messageID=status.get("messageID"),
                    typingIndicator=status.get("typingIndicator"),
                )
            )
        )

    # ------------------------------------------------------------------
    # Memory management (WebSocket-only)
    # ------------------------------------------------------------------

    @contextmanager
    def keep_alive(self) -> Iterator[None]:
        """Keep this chat model alive for the duration of the ``with`` block.

        While at least one ``keep_alive()`` context is open, the
        :class:`~jupyterlab_chat.chat_manager.ChatManager` will not free this
        model even if every client disconnects -- neither when the last client
        leaves nor on the inactivity poll. Use it to guard a server-side
        operation that must outlive the connected clients, e.g. an AI persona
        still producing a reply after the user closed the tab::

            with chat.keep_alive():
                await do_some_long_work()
                chat.add_message(NewMessage(body="done", sender=persona_id))

        Reentrant: nested or concurrent contexts each hold the chat alive until
        the last one exits. Once no contexts remain the model is reclaimed
        normally -- on the next inactivity poll if the last client already left.

        Exclusive to the WebSocket backend. Under real-time collaboration a
        chat's memory is managed by jupyter-collaboration at a higher layer, so
        keeping it alive here is neither needed nor wired in.
        """
        self._keep_alive_depth += 1
        try:
            yield
        finally:
            self._keep_alive_depth -= 1

    @property
    def is_kept_alive(self) -> bool:
        """Whether at least one :meth:`keep_alive` context is currently open."""
        return self._keep_alive_depth > 0

    def resolve_message(self, message: dict) -> dict:
        """Return a copy of a message with attachment IDs replaced by full objects."""
        atts = message.get("attachments")
        if not atts:
            return message
        resolved = dict(message)
        resolved["attachments"] = [
            self._attachments[att_id]
            for att_id in atts
            if att_id in self._attachments
        ]
        return resolved

    # ------------------------------------------------------------------
    # BaseChatModel implementation
    # ------------------------------------------------------------------

    def get_id(self) -> str:
        # The id is stored in the chat file's metadata (same as the
        # collaborative model). Create one lazily if it does not exist yet.
        return self._metadata.setdefault("id", uuid.uuid4().hex)  # type: ignore[return-value]

    def get_path(self) -> str:
        # The WebSocket model does not use file IDs; its path is tracked
        # in-process and kept current on in-band moves (see _on_contents_event).
        return self.path

    async def _on_contents_event(self, logger, schema_id: str, data: dict) -> None:
        """Update the tracked path when the backing file is moved in-band.

        Calls :meth:`_on_path_change` when the rename affects this file directly
        or renames one of its ancestor directories. Only ContentsManager
        (REST/API) operations emit these events; out-of-band moves are not seen.
        """
        if data.get("action") != "rename":
            return
        source = data.get("source_path")
        dest = data.get("path")
        if not source or not dest:
            return
        if self.path == source:
            self._on_path_change(dest)
        elif os.path.commonpath((source, self.path)) == source:
            # `self.path` is nested under the renamed directory `source`.
            self._on_path_change(
                os.path.join(dest, os.path.relpath(self.path, source))
            )

    def _on_path_change(self, new_path: str) -> None:
        """Point the model at ``new_path`` (the file's new location)."""
        if new_path != self.path:
            _log.info("Chat file moved: '%s' -> '%s'", self.path, new_path)
            self.path = new_path

    def dispose(self) -> None:
        """Remove the ContentsManager event listener when the model is freed."""
        if self._event_logger is not None:
            self._event_logger.remove_listener(
                schema_id=CONTENTS_EVENT_SCHEMA_ID,
                listener=self._on_contents_event,
            )

    def get_message(self, id: str) -> Optional[Message]:
        idx = self._indexes_by_id.get(id)
        if idx is None:
            return None
        return Message(**self._messages[idx])

    def get_messages(self) -> list[Message]:
        return [Message(**msg_dict) for msg_dict in self._messages]

    def get_users(self) -> dict[str, User]:
        return {
            username: User(**user_dict)
            for username, user_dict in self._users.items()
        }

    def get_metadata(self) -> dict[str, Any]:
        return dict(self._metadata)  # type: ignore[arg-type]

    def get_attachments(self) -> dict[str, Union[FileAttachment, NotebookAttachment]]:
        result: dict[str, Union[FileAttachment, NotebookAttachment]] = {}
        for att_id, att_dict in self._attachments.items():
            if att_dict.get("type") == "notebook":
                result[att_id] = NotebookAttachment(**att_dict)
            else:
                result[att_id] = FileAttachment(**att_dict)
        return result

    def add_message(
        self,
        new_message: NewMessage,
        trigger_actions: list[Callable] | None = None,
    ) -> str:
        timestamp = time.time()
        msg_id = str(uuid.uuid4())
        message = Message(**asdict(new_message), time=timestamp, id=msg_id)

        if trigger_actions:
            for callback in trigger_actions:
                callback(message, self)

        msg_dict = asdict(message, dict_factory=message_asdict_factory)
        idx = next(
            (i for i, m in enumerate(self._messages) if m.get("time", 0) > timestamp),
            len(self._messages),
        )
        self._messages.insert(idx, msg_dict)
        self._indexes_by_id = {m["id"]: i for i, m in enumerate(self._messages)}
        self.save()
        self.broadcast(
            to_wire(ServerMessageMessage(message=self.resolve_message(msg_dict)))
        )
        self._emit_message_event(ChatMessageAction.SERVER_MSG_SENT, message)
        return msg_id

    def update_message(
        self,
        update: Message,
        append: bool = False,
        trigger_actions: list[Callable] | None = None,
    ) -> None:
        idx = self._indexes_by_id.get(update.id)
        if idx is None:
            return
        msg_dict = self._messages[idx]
        if update.body and append:
            update.body = msg_dict.get("body", "") + update.body
        if trigger_actions:
            for callback in trigger_actions:
                callback(update, self)
        update_dict = asdict(update, dict_factory=message_asdict_factory)
        for key, value in update_dict.items():
            if value is not None or key in msg_dict:
                msg_dict[key] = value
        self.save()
        self.broadcast(
            to_wire(ServerMessageMessage(message=self.resolve_message(msg_dict)))
        )
        updated = self.get_message(update.id)
        if updated is not None:
            self._emit_message_event(
                ChatMessageAction.SERVER_MSG_UPDATED, updated
            )

    def set_attachment(
        self, attachment: Union[FileAttachment, NotebookAttachment]
    ) -> str:
        att_dict = asdict(attachment)
        att_json = json.dumps(att_dict, sort_keys=True)
        att_id = next(
            (
                id
                for id, existing in self._attachments.items()
                if json.dumps(existing, sort_keys=True) == att_json
            ),
            None,
        ) or str(uuid.uuid4())
        self._attachments[att_id] = att_dict
        return att_id

    def set_user(self, user: User) -> None:
        user_dict = asdict(user)
        self._users[user.username] = user_dict
        # Push the change to connected clients. Personas register themselves via
        # this method *after* clients have connected, so without this broadcast a
        # newly added user (e.g. an AI agent's name/avatar) would never appear.
        self.broadcast(to_wire(ServerUsersMessage(users={user.username: user_dict})))

    def set_metadata(self, name: str, metadata: Any) -> None:
        self._metadata[name] = metadata
        # Push the change to connected clients (same rationale as set_user).
        self.broadcast(to_wire(ServerMetadataMessage(metadata={name: metadata})))

    # ------------------------------------------------------------------
    # Message observers
    # ------------------------------------------------------------------

    def observe_messages(
        self, callback: MessageObserverCallback
    ) -> MessageObserver:
        self._message_observers.append(callback)
        return MessageObserver(_handle=callback)

    def unobserve_messages(self, observer: MessageObserver) -> None:
        try:
            self._message_observers.remove(observer._handle)
        except ValueError:
            pass

    def _emit_message_event(
        self, action: ChatMessageAction, message: Message
    ) -> None:
        """Notify all message observers of a change. Observer errors are logged
        but never interrupt message handling."""
        if not self._message_observers:
            return
        event = ChatMessageEvent(action=action, message=message)
        for callback in list(self._message_observers):
            try:
                callback(event)
            except Exception:  # pragma: no cover - defensive
                _log.exception("Message observer failed for %s", action)
