# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union

from tornado import websocket

from .models import (
    BaseChatModel,
    FileAttachment,
    Message,
    NewMessage,
    NotebookAttachment,
    User,
    message_asdict_factory,
)


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
        self._users[user.username] = user.to_dict()

    def set_metadata(self, name: str, metadata: Any) -> None:
        self._metadata[name] = metadata
