# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from jupyter_server.base.handlers import JupyterHandler
from tornado import web, websocket

from .models import User


@dataclass
class _ChatRoom:
    """In-memory state for a single .chat file."""

    path: str
    handlers: Dict[str, "WSChatHandler"] = field(default_factory=dict)
    messages: List[dict] = field(default_factory=list)
    users: Dict[str, dict] = field(default_factory=dict)
    attachments: Dict[str, dict] = field(default_factory=dict)
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "messages": self.messages,
            "users": self.users,
            "attachments": self.attachments,
            "metadata": self.metadata,
        }


class WSChatHandler(JupyterHandler, websocket.WebSocketHandler):
    """
    WebSocket handler for a single chat file.

    One instance per connected client; all clients connected to the same
    .chat file share a _ChatRoom stored in settings["ws_chat_rooms"].
    """

    @property
    def _chat_rooms(self) -> Dict[str, _ChatRoom]:
        return self.settings["ws_chat_rooms"]

    @property
    def _root_dir(self) -> Path:
        return Path(self.settings.get("server_root_dir", ".")).expanduser().resolve()

    def pre_get(self):
        user = self.current_user
        if user is None:
            self.log.warning("Couldn't authenticate WebSocket connection")
            raise web.HTTPError(403)
        if not self.authorizer.is_authorized(self, user, "execute", "events"):
            raise web.HTTPError(403)

    async def get(self, *args, **kwargs):
        self.pre_get()
        await super().get(*args, **kwargs)

    def open(self):
        path = self.get_query_argument("path", None)
        if path is None:
            self.close(1008, "Missing 'path' query parameter")
            return

        self._path = path
        self._client_id = uuid.uuid4().hex

        if path not in self._chat_rooms:
            room = _ChatRoom(path=path)
            self._load_from_file(room)
            self._chat_rooms[path] = room

        room = self._chat_rooms[path]
        room.handlers[self._client_id] = self

        # Register the connecting user
        current_user = self.current_user
        user = User(
            username=current_user.username,
            name=current_user.name or current_user.username,
            display_name=current_user.display_name or current_user.username,
            initials=current_user.initials or current_user.username[0].upper(),
            color=getattr(current_user, "color", None),
            avatar_url=getattr(current_user, "avatar_url", None),
        )
        room.users[current_user.username] = asdict(user)

        # Send full history so the client can render existing messages
        self.write_message(json.dumps({
            "type": "connection",
            "client_id": self._client_id,
            "messages": [self._resolve_message(m, room) for m in room.messages],
            "users": room.users,
        }))

        # Notify existing clients about the updated users map
        users_update = json.dumps({"type": "users", "users": room.users})
        for client_id, handler in list(room.handlers.items()):
            if client_id != self._client_id:
                try:
                    handler.write_message(users_update)
                except websocket.WebSocketClosedError:
                    pass

        self.log.info("WS chat client %s connected to room '%s'", self._client_id, path)

    def _load_from_file(self, room: _ChatRoom) -> None:
        full_path = self._root_dir / room.path
        try:
            with open(full_path) as f:
                content = json.load(f)
            room.messages = content.get("messages", [])
            room.users = content.get("users", {})
            room.attachments = content.get("attachments", {})
            room.metadata = content.get("metadata", {})
        except (FileNotFoundError, json.JSONDecodeError):
            # New or empty chat file — generate an id and leave content empty
            room.metadata = {"id": uuid.uuid4().hex}
        except Exception as e:
            self.log.error("Error loading chat file '%s': %s", full_path, e)

    def _store_attachments(self, attachments: list[dict], room: _ChatRoom) -> list[str]:
        """Store attachment dicts in room.attachments, return their IDs."""
        ids = []
        for att in attachments:
            att_json = json.dumps(att, sort_keys=True)
            att_id = next(
                (
                    id for id, existing in room.attachments.items()
                    if json.dumps(existing, sort_keys=True) == att_json
                ),
                None,
            ) or str(uuid.uuid4())
            room.attachments[att_id] = att
            ids.append(att_id)
        return ids

    def _resolve_message(self, message: dict, room: _ChatRoom) -> dict:
        """Return a copy of a message with attachment IDs replaced by full objects."""
        atts = message.get("attachments")
        if not atts:
            return message
        resolved = dict(message)
        resolved["attachments"] = [
            room.attachments[att_id]
            for att_id in atts
            if att_id in room.attachments
        ]
        return resolved

    def _save_to_file(self, room: _ChatRoom) -> None:
        full_path = self._root_dir / room.path
        try:
            with open(full_path, "w") as f:
                json.dump(room.to_dict(), f, indent=2)
        except Exception as e:
            self.log.error("Error saving chat file '%s': %s", full_path, e)

    async def on_message(self, raw: str) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            self.log.error("Invalid JSON received on WS chat connection")
            return

        room = self._chat_rooms.get(getattr(self, "_path", None))
        if room is None:
            return

        if data.get("is_update"):
            self._handle_update_message(data, room)
        else:
            self._handle_new_message(data, room)

    def _handle_new_message(self, data: dict, room: _ChatRoom) -> None:
        timestamp = time.time()
        message: dict = {
            "id": data.get("id") or str(uuid.uuid4()),
            "body": data.get("body", ""),
            "time": timestamp,
            "sender": self.current_user.username,
            "type": "msg",
            "raw_time": False,
        }
        for key in ("mentions", "metadata", "mime_model"):
            if key in data:
                message[key] = data[key]
        if "attachments" in data:
            message["attachments"] = self._store_attachments(data["attachments"], room)

        # Keep messages sorted by timestamp
        idx = next(
            (i for i, m in enumerate(room.messages) if m.get("time", 0) > timestamp),
            len(room.messages),
        )
        room.messages.insert(idx, message)
        self._save_to_file(room)
        self._broadcast(room, json.dumps({"type": "msg", "message": self._resolve_message(message, room)}))

    def _handle_update_message(self, data: dict, room: _ChatRoom) -> None:
        msg_id = data.get("id")
        if not msg_id:
            return
        updated_msg = None
        for msg in room.messages:
            if msg.get("id") == msg_id:
                for key in ("body", "deleted", "edited", "mentions", "metadata"):
                    if key in data:
                        msg[key] = data[key]
                if "attachments" in data:
                    msg["attachments"] = self._store_attachments(data["attachments"], room)
                updated_msg = msg
                break
        self._save_to_file(room)
        if updated_msg is not None:
            self._broadcast(room, json.dumps({"type": "msg", "message": self._resolve_message(updated_msg, room)}))

    def _broadcast(self, room: _ChatRoom, message: str) -> None:
        for handler in list(room.handlers.values()):
            try:
                handler.write_message(message)
            except websocket.WebSocketClosedError:
                pass

    def on_close(self) -> None:
        path = getattr(self, "_path", None)
        client_id = getattr(self, "_client_id", None)
        room = self._chat_rooms.get(path) if path else None
        if room and client_id:
            room.handlers.pop(client_id, None)
            # Evict the room when the last client disconnects
            if not room.handlers:
                del self._chat_rooms[path]
        self.log.info("WS chat client %s disconnected", client_id)
