# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import time
import uuid
from pathlib import Path
from typing import Dict

from jupyter_server.base.handlers import JupyterHandler
from tornado import web, websocket

from .models import ChatMessageAction, User
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

    def _parse_client_user(self):
        """Parse the optional client-provided identity from the connect query.

        Returns a ``User`` built from the frontend's ``user`` query argument, or
        ``None`` when it is absent or malformed.
        """
        raw = self.get_query_argument("user", None)
        if not raw:
            return None
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        if not isinstance(data, dict):
            return None
        username = data.get("username")
        if not username:
            return None
        return User(
            username=username,
            name=data.get("name") or username,
            display_name=data.get("display_name") or username,
            initials=data.get("initials") or username[0].upper(),
            color=data.get("color"),
            avatar_url=data.get("avatar_url"),
        )

    def open(self, *args: str, **kwargs: str):
        path = self.get_query_argument("path", None)
        if path is None:
            self.close(1008, "Missing 'path' query parameter")
            return

        self._path = path
        self._client_id = uuid.uuid4().hex

        # The manager owns get-or-create and emits the `opened` lifecycle event
        # (once, when the model is first created).
        model = self._chat_manager.ws_open(path)
        model.handlers[self._client_id] = self

        # Register the connecting user. Prefer the client-provided identity
        # (matching collaborative mode, where the user is set on the frontend)
        # so it equals the frontend's own identity and is excluded from its own
        # mention suggestions. Fall back to the authenticated server user for
        # older clients that do not send their identity.
        current_user = self.current_user
        user = self._parse_client_user() or User(
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
        self._chat_manager.client_connected(path, self._client_id)

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
        self._chat_manager.ws_activity(path)

        if data.get("is_update"):
            self._handle_update_message(data, model)
        else:
            self._handle_new_message(data, model)

    def _handle_new_message(self, data: dict, model: WsChatModel) -> None:
        timestamp = time.time()
        # Prefer the client-provided identity as the sender, matching the
        # collaborative mode where the sender is set on the frontend. Fall back
        # to the authenticated server user for older clients that do not send
        # their identity.
        client_user = data.get("user")
        new_user_registered = False
        if isinstance(client_user, dict) and client_user.get("username"):
            sender = client_user["username"]
            if model._users.get(sender) != client_user:
                model._users[sender] = client_user
                new_user_registered = True
        else:
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
        # If we learned a new sender identity, tell all clients first so they can
        # resolve the sender (display name/avatar) when the message arrives.
        if new_user_registered:
            model.broadcast(json.dumps({"type": "users", "users": model._users}))
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
        model = self._chat_models.get(path)
        if model and client_id:
            model.handlers.pop(client_id, None)
            self._chat_manager.client_disconnected(path, client_id)
            if not model.handlers:
                # Don't free immediately: the manager reclaims the model after a
                # grace period of inactivity unless a client reconnects.
                self._chat_manager.ws_client_gone(path)
        self.log.info("WS chat client %s disconnected", client_id)
