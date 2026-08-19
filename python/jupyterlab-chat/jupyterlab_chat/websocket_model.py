# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import logging
import time
import uuid
from dataclasses import asdict
from itertools import count
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

from tornado import websocket

from .pubsub import Payload, PubSubCallback, SubToken
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


class WsChatModel(BaseChatModel):
    """
    In-memory state for a single .chat file in WebSocket mode.

    Implements BaseChatModel so trigger actions and bots work identically
    to the collaborative (YChat) backend.
    """

    def __init__(self, path: str, root_dir: Path):
        self.path = path
        self.root_dir = root_dir
        self.handlers: Dict[str, websocket.WebSocketHandler] = {}
        self._messages: list[dict] = []
        self._indexes_by_id: dict[str, int] = {}
        self._users: Dict[str, dict] = {}
        self._attachments: Dict[str, dict] = {}
        self._metadata: Dict[str, object] = {}
        self._message_observers: List[MessageObserverCallback] = []
        # Subscribers to document map topics (/chat/users, /chat/metadata,
        # /chat/attachments), notified with the whole current map on each change.
        self._doc_subs: Dict[str, Dict[int, PubSubCallback]] = {}
        self._doc_sub_ids = count()

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
            self._metadata = {"id": uuid.uuid4().hex}
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

    def broadcast_writing_status(self, user, status=None) -> None:
        """Broadcast an ephemeral writing status for ``user`` to all clients.

        Not persisted to the ``.chat`` file. ``user`` may be a ``User`` or a
        mapping (with at least ``username``); ``status`` is ``None`` (stopped) or
        a mapping with optional ``messageID``/``typingIndicator``. The full user
        object is included so recipients can display the writer without having
        seen a message from them.
        """
        if isinstance(user, dict):
            user_dict = user
        else:
            user_dict = {
                "username": user.username,
                "name": getattr(user, "name", None),
                "display_name": getattr(user, "display_name", None),
                "initials": getattr(user, "initials", None),
                "color": getattr(user, "color", None),
                "avatar_url": getattr(user, "avatar_url", None),
            }
        payload: dict = {
            "type": "writing",
            "user": user_dict,
            "state": status is not None,
        }
        if status:
            for key in ("messageID", "typingIndicator"):
                value = status.get(key)
                if value is not None:
                    payload[key] = value
        self.broadcast(json.dumps(payload))

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

    def get_id(self) -> Optional[str]:
        return self._metadata.get("id")  # type: ignore[return-value]

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
            json.dumps({"type": "msg", "message": self.resolve_message(msg_dict)})
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
            json.dumps({"type": "msg", "message": self.resolve_message(msg_dict)})
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
        self._notify_document(self.CHAT_ATTACHMENTS_TOPIC)
        return att_id

    def set_user(self, user: User) -> None:
        self._users[user.username] = asdict(user)
        self._notify_document(self.CHAT_USERS_TOPIC)

    def set_metadata(self, name: str, metadata: Any) -> None:
        self._metadata[name] = metadata
        self._notify_document(self.CHAT_METADATA_TOPIC)

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

    # ------------------------------------------------------------------
    # Generic pub/sub API (RTC-free transport)
    #
    # Document topics (/chat/*) route to the model's own state (persisted to the
    # .chat file); presence topics use the inherited in-memory PubSubBus. This is
    # the RTC-free counterpart to YChat's Y-type / awareness implementation.
    # ------------------------------------------------------------------
    def pub(self, topic: str, data: Any, client_id: str = "server") -> None:
        if topic == self.CHAT_MESSAGES_TOPIC:
            self.add_message(NewMessage(**data))
        elif topic == self.CHAT_USERS_TOPIC:
            self.set_user(User(**data))
        elif topic == self.CHAT_METADATA_TOPIC:
            for key, value in dict(data).items():
                self.set_metadata(key, value)
        elif topic == self.CHAT_ATTACHMENTS_TOPIC:
            attachment: Union[FileAttachment, NotebookAttachment] = (
                NotebookAttachment(**data)
                if data.get("type") == "notebook"
                else FileAttachment(**data)
            )
            self.set_attachment(attachment)
        else:
            self._pubsub().pub(topic, data, client_id)

    def sub(self, topic: str, callback: PubSubCallback) -> SubToken:
        if topic == self.CHAT_MESSAGES_TOPIC:
            return self._sub_chat_messages(callback)
        if topic in (
            self.CHAT_USERS_TOPIC,
            self.CHAT_METADATA_TOPIC,
            self.CHAT_ATTACHMENTS_TOPIC,
        ):
            return self._sub_document(topic, callback)
        return self._pubsub().sub(topic, callback)

    def _current_document(self, topic: str) -> dict:
        if topic == self.CHAT_USERS_TOPIC:
            return dict(self._users)
        if topic == self.CHAT_METADATA_TOPIC:
            return dict(self._metadata)
        if topic == self.CHAT_ATTACHMENTS_TOPIC:
            return dict(self._attachments)
        return {}

    def _sub_document(self, topic: str, callback: PubSubCallback) -> SubToken:
        # Snapshot with the whole current mapping, then re-notify on each change
        # (replace semantics, matching YChat's document Map subscription).
        callback(Payload(client_id="server", data=self._current_document(topic)))
        sub_id = next(self._doc_sub_ids)
        self._doc_subs.setdefault(topic, {})[sub_id] = callback
        return SubToken(lambda: self._remove_doc_sub(topic, sub_id))

    def _remove_doc_sub(self, topic: str, sub_id: int) -> None:
        subs = self._doc_subs.get(topic)
        if subs is not None:
            subs.pop(sub_id, None)
            if not subs:
                self._doc_subs.pop(topic, None)

    def _notify_document(self, topic: str) -> None:
        subs = self._doc_subs.get(topic)
        if not subs:
            return
        payload = Payload(client_id="server", data=self._current_document(topic))
        for callback in list(subs.values()):
            try:
                callback(payload)
            except Exception:  # pragma: no cover - defensive
                _log.exception("Document subscriber failed for %s", topic)
