# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import time
import uuid
from pathlib import Path
from typing import Dict

from jupyter_server.base.handlers import JupyterHandler
from tornado import web, websocket

from .models import User
from .websocket_model import WsChatModel


class WSChatHandler(JupyterHandler, websocket.WebSocketHandler):
    """
    WebSocket handler for a single chat file.

    One instance per connected client; all clients connected to the same
    .chat file share a WsChatModel stored in settings["ws_chat_models"].
    """
    _path: str

    @property
    def _chat_models(self) -> Dict[str, WsChatModel]:
        return self.settings["ws_chat_models"]

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

    def open(self, *args: str, **kwargs: str):
        path = self.get_query_argument("path", None)
        if path is None:
            self.close(1008, "Missing 'path' query parameter")
            return

        self._path = path
        self._client_id = uuid.uuid4().hex

        if path not in self._chat_models:
            model = WsChatModel(path=path, root_dir=self._root_dir)
            model.load_from_file()
            self._chat_models[path] = model

        model = self._chat_models[path]
        model.handlers[self._client_id] = self

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
        model.set_user(user)

        # Send full history so the client can render existing messages
        self.write_message(json.dumps({
            "type": "connection",
            "client_id": self._client_id,
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

    async def on_message(self, raw: str | bytes) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            self.log.error("Invalid JSON received on WS chat connection")
            return

        path = self._path
        if not path:
            return

        model = self._chat_models.get(path)
        if model is None:
            return

        if data.get("is_update"):
            self._handle_update_message(data, model)
        else:
            self._handle_new_message(data, model)

    def _handle_new_message(self, data: dict, model: WsChatModel) -> None:
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
        model = self._chat_models.get(path)
        if model and client_id:
            model.handlers.pop(client_id, None)
            if not model.handlers:
                del self._chat_models[path]
        self.log.info("WS chat client %s disconnected", client_id)
