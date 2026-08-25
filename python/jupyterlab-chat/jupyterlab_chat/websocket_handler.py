# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict

from jupyter_server.base.handlers import JupyterHandler
from tornado import web, websocket

from .models import ChatMessageAction, User
from .websocket_model import WsChatModel


def is_safe_chat_path(path: str, root_dir: Path) -> bool:
    """Whether ``path`` is a safe, in-root relative chat path.

    Rejects empty, NUL-containing, absolute, and parent-escaping (``..``) paths
    so a malformed or hostile path can never read or write outside the server
    root. ``os.path`` is used (not ``posixpath``) as the correct cross-platform
    choice, and ``commonpath`` confirms the resolved path stays within root.
    """
    if not path or "\x00" in path or os.path.isabs(path):
        return False
    root = str(root_dir)
    full = os.path.normpath(os.path.join(root, path))
    try:
        return os.path.commonpath((root, full)) == root
    except ValueError:
        return False


class WSChatHandler(JupyterHandler, websocket.WebSocketHandler):
    """
    WebSocket handler for a single chat file.

    One instance per connected client; all clients connected to the same
    .chat file share a WsChatModel; the registry lives in settings["chats_by_id"].
    """
    _path: str

    def initialize(self, *args: Any, **kwargs: Any) -> None:
        super().initialize(*args, **kwargs)
        # Set as an instance attribute (not a class-level default) so
        # ``self._path`` always resolves -- including when the connection closes
        # before ``open()`` runs, e.g. a connection that never sends a decodable
        # chat path, so ``open()`` calls ``self.close()`` and returns early.
        # Both ``on_message`` and ``on_close`` treat a falsy ``_path`` as
        # "never opened" and return.
        self._path = ""

    @property
    def _chat_manager(self):
        return self.settings["chat_manager"]

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
        result = super().get(*args, **kwargs)
        if result is not None:
            await result

    def open(self, *args: str, **kwargs: str):
        # tornado url-unescapes the captured route segment, so ``args[0]`` is the
        # decoded chat path (with slashes restored).
        path = args[0] if args else ""
        if not is_safe_chat_path(path, self._root_dir):
            # 1008 (policy violation): the path is missing, unparseable, or would
            # escape the server root. The frontend surfaces this to the user.
            self.close(1008, "Invalid chat path")
            return

        self._path = path
        self._client_id = uuid.uuid4().hex

        # The manager owns get-or-create and emits the `opened` lifecycle event
        # (once, when the model is first created).
        model = self._chat_manager.ws_open(path)
        self._model = model
        model.handlers[self._client_id] = self

        # Register the connecting user using the server's authenticated identity.
        # The WS transport is single-user, so every connection -- from any tab or
        # client -- is the same authenticated user; there is no separate frontend
        # identity to carry.
        current_user = self.current_user
        user = User(
            username=current_user.username,
            name=current_user.name or current_user.username,
            display_name=current_user.display_name or current_user.username,
            initials=current_user.initials or current_user.username[0].upper(),
            color=getattr(current_user, "color", None),
            avatar_url=getattr(current_user, "avatar_url", None),
        )
        model.set_user(user)

        # Send full history so the client can render existing messages
        self.write_message(json.dumps({
            "type": "connection",
            "client_id": self._client_id,
            "id": model.get_id(),
            "messages": [model.resolve_message(m) for m in model._messages],
            "users": model._users,
        }))

        # Notify existing clients about the updated users map
        users_update = json.dumps({"type": "users", "users": model._users})
        for client_id, handler in list(model.handlers.items()):
            if client_id != self._client_id:
                try:
                    handler.write_message(users_update)
                except websocket.WebSocketClosedError:
                    pass

        self.log.info("WS chat client %s connected to model '%s'", self._client_id, path)
        self._chat_manager.on_client_connect(path, self._client_id, model.get_id())

    async def on_message(self, raw: str | bytes) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            self.log.error("Invalid JSON received on WS chat connection")
            return

        path = self._path
        if not path:
            return

        model = getattr(self, "_model", None)
        if model is None:
            return
        self._chat_manager.ws_activity(model.get_id())

        if data.get("is_update"):
            self._handle_update_message(data, model)
        else:
            self._handle_new_message(data, model)

    def _handle_new_message(self, data: dict, model: WsChatModel) -> None:
        timestamp = time.time()
        # The WS transport is single-user: the sender is always the
        # authenticated server user, already registered in `open()`.
        sender = self.current_user.username
        message: dict = {
            "id": data.get("id") or str(uuid.uuid4()),
            "body": data.get("body", ""),
            "time": timestamp,
            "sender": sender,
            "type": "msg",
            "raw_time": False,
        }
        for key in ("mentions", "metadata", "mime_model"):
            if key in data:
                message[key] = data[key]
        if "attachments" in data:
            message["attachments"] = self._store_attachments(data["attachments"], model)

        idx = next(
            (i for i, m in enumerate(model._messages) if m.get("time", 0) > timestamp),
            len(model._messages),
        )
        model._messages.insert(idx, message)
        model._indexes_by_id = {m["id"]: i for i, m in enumerate(model._messages)}
        model.save()
        model.broadcast(
            json.dumps({"type": "msg", "message": model.resolve_message(message)})
        )
        received = model.get_message(message["id"])
        if received is not None:
            model._emit_message_event(
                ChatMessageAction.CLIENT_MSG_RECEIVED, received
            )

    def _handle_update_message(self, data: dict, model: WsChatModel) -> None:
        msg_id = data.get("id")
        if not msg_id:
            return
        idx = model._indexes_by_id.get(msg_id)
        if idx is None:
            return
        msg = model._messages[idx]
        for key in ("body", "deleted", "edited", "mentions", "metadata"):
            if key in data:
                msg[key] = data[key]
        if "attachments" in data:
            msg["attachments"] = self._store_attachments(data["attachments"], model)
        model.save()
        model.broadcast(
            json.dumps({"type": "msg", "message": model.resolve_message(msg)})
        )
        edited = model.get_message(msg_id)
        if edited is not None:
            model._emit_message_event(
                ChatMessageAction.CLIENT_MSG_EDITED, edited
            )

    def _store_attachments(self, attachments: list[dict], model: WsChatModel) -> list[str]:
        """Store attachment dicts via the model's set_attachment, return their IDs."""
        ids = []
        for att in attachments:
            att_json = json.dumps(att, sort_keys=True)
            att_id = next(
                (
                    id for id, existing in model._attachments.items()
                    if json.dumps(existing, sort_keys=True) == att_json
                ),
                None,
            ) or str(uuid.uuid4())
            model._attachments[att_id] = att
            ids.append(att_id)
        return ids

    def on_close(self) -> None:
        path = self._path
        if not path:
            return

        client_id = getattr(self, "_client_id", None)
        model = getattr(self, "_model", None)
        if model and client_id:
            model.handlers.pop(client_id, None)
            self._chat_manager.on_client_disconnect(
                model.get_path(), client_id, model.get_id()
            )
            if not model.handlers:
                # Don't free immediately: the manager reclaims the model after a
                # grace period of inactivity unless a client reconnects.
                self._chat_manager.ws_client_gone(model.get_id())
        self.log.info("WS chat client %s disconnected", client_id)
