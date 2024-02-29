import getpass
import json
import time
import uuid
from asyncio import AbstractEventLoop
from dataclasses import asdict
from typing import TYPE_CHECKING, Dict, List, Optional

from jupyter_server.base.handlers import APIHandler as BaseAPIHandler, JupyterHandler
from jupyter_server.utils import url_path_join
from langchain.pydantic_v1 import ValidationError
from tornado import web, websocket

from .config_manager import WriteConflictError

from .models import (
    ChatClient,
    ChatHistory,
    ChatMessage,
    ChatRequest,
    ChatUser,
    ConnectionMessage,
    ChatMessage,
    Message,
    UpdateConfigRequest,
)


class ChatHistoryHandler(BaseAPIHandler):
    """Handler to return message history"""

    _messages = []

    @property
    def chat_history(self):
        return self.settings["chat_history"]

    @chat_history.setter
    def _chat_history_setter(self, new_history):
        self.settings["chat_history"] = new_history

    @web.authenticated
    async def get(self):
        history = ChatHistory(messages=self.chat_history)
        self.finish(history.json())


class ChatHandler(JupyterHandler, websocket.WebSocketHandler):
    """
    A websocket handler for chat.
    """

    @property
    def root_chat_handlers(self) -> Dict[str, "ChatHandler"]:
        """Dictionary mapping client IDs to their corresponding ChatHandler
        instances."""
        return self.settings["root_chat_handlers"]

    @property
    def chat_clients(self) -> Dict[str, ChatClient]:
        """Dictionary mapping client IDs to their ChatClient objects that store
        metadata."""
        return self.settings["chat_clients"]

    @property
    def chat_client(self) -> ChatClient:
        """Returns ChatClient object associated with the current connection."""
        return self.chat_clients[self.client_id]

    @property
    def chat_history(self) -> List[ChatMessage]:
        return self.settings["chat_history"]

    def initialize(self):
        self.log.debug("Initializing websocket connection %s", self.request.path)

    def pre_get(self):
        """Handles authentication/authorization."""
        # authenticate the request before opening the websocket
        user = self.current_user
        if user is None:
            self.log.warning("Couldn't authenticate WebSocket connection")
            raise web.HTTPError(403)

        # authorize the user.
        if not self.authorizer.is_authorized(self, user, "execute", "events"):
            raise web.HTTPError(403)

    async def get(self, *args, **kwargs):
        """Get an event socket."""
        self.pre_get()
        res = super().get(*args, **kwargs)
        await res

    def get_chat_user(self) -> ChatUser:
        """ Retrieves the current user synthesized from the server's current shell
        environment."""
        login = getpass.getuser()
        initials = login[0].capitalize()
        return ChatUser(
            username=login,
            initials=initials,
            name=login,
            display_name=login,
            color=None,
            avatar_url=None,
        )

    def generate_client_id(self):
        """Generates a client ID to identify the current WS connection."""
        return uuid.uuid4().hex

    def open(self):
        """Handles opening of a WebSocket connection. Client ID can be retrieved
        from `self.client_id`."""

        current_user = self.get_chat_user().dict()
        client_id = self.generate_client_id()

        self.root_chat_handlers[client_id] = self
        self.chat_clients[client_id] = ChatClient(**current_user, id=client_id)
        self.client_id = client_id
        self.write_message(ConnectionMessage(client_id=client_id).dict())

        self.log.info(f"Client connected. ID: {client_id}")
        self.log.debug("Clients are : %s", self.root_chat_handlers.keys())

    def broadcast_message(self, message: Message):
        """Broadcasts message to all connected clients.
        Appends message to chat history.
        """

        self.log.debug("Broadcasting message: %s to all clients...", message)
        client_ids = self.root_chat_handlers.keys()

        for client_id in client_ids:
            client = self.root_chat_handlers[client_id]
            if client:
                client.write_message(message.dict())

        # Only append ChatMessage instances to history, not control messages
        if isinstance(message, ChatMessage):
            self.chat_history.append(message)

    async def on_message(self, message):
        self.log.debug("Message received: %s", message)

        try:
            message = json.loads(message)
            chat_request = ChatRequest(**message)
        except ValidationError as e:
            self.log.error(e)
            return

        # message broadcast to chat clients
        chat_message_id = str(uuid.uuid4())
        chat_message = ChatMessage(
            id=chat_message_id,
            time=time.time(),
            body=chat_request.prompt,
            sender=self.chat_client,
        )

        # broadcast the message to other clients
        self.broadcast_message(message=chat_message)

    def on_close(self):
        self.log.debug("Disconnecting client with user %s", self.client_id)

        self.root_chat_handlers.pop(self.client_id, None)
        self.chat_clients.pop(self.client_id, None)

        self.log.info(f"Client disconnected. ID: {self.client_id}")
        self.log.debug("Chat clients: %s", self.root_chat_handlers.keys())


class GlobalConfigHandler(BaseAPIHandler):
    """API handler for fetching and setting the
    model and emebddings config.
    """

    @property
    def config_manager(self):
        return self.settings["chat_config_manager"]

    @web.authenticated
    def get(self):
        config = self.config_manager.get_config()
        if not config:
            raise web.HTTPError(500, "No config found.")

        self.finish(config.json())

    @web.authenticated
    def post(self):
        try:
            config = UpdateConfigRequest(**self.get_json_body())
            self.config_manager.update_config(config)
            self.set_status(204)
            self.finish()
        except (ValidationError, WriteConflictError) as e:
            self.log.exception(e)
            raise web.HTTPError(500, str(e)) from e
        except ValueError as e:
            self.log.exception(e)
            raise web.HTTPError(500, str(e.cause) if hasattr(e, "cause") else str(e))
        except Exception as e:
            self.log.exception(e)
            raise web.HTTPError(
                500, "Unexpected error occurred while updating the config."
            ) from e
