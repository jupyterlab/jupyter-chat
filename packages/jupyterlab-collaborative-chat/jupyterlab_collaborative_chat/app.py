# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import jupyter_collaboration
import time
import uuid
from functools import partial
from jupyter_collaboration.utils import JUPYTER_COLLABORATION_EVENTS_URI
from jupyter_events import EventLogger
from jupyter_server.extension.application import ExtensionApp
from pycrdt import ArrayEvent

from .ychat import YChat


if int(jupyter_collaboration.__version__[0]) >= 3:
    COLLAB_VERSION = 3
else:
    COLLAB_VERSION = 2

BOT = {
    "username": str(uuid.uuid4()),
    "name": "the bot",
    "display_name": "Bot user"
}


class CollaborativeChat(ExtensionApp):
    name = "jupyterlab_collaborative_chat"
    app_name = "Collaborative chat"
    description = """
    Enables Collaborative Chat Server extension
    """


    def initialize(self):
        super().initialize()
        self.event_logger = self.serverapp.web_app.settings["event_logger"]
        self.event_logger.add_listener(
            schema_id=JUPYTER_COLLABORATION_EVENTS_URI,
            listener=self.connect_chat
        )

    async def connect_chat(self, logger: EventLogger, schema_id: str, data: dict) -> None:
        if data["room"].startswith("text:chat:") \
            and data["action"] == "initialize"\
            and data["msg"] == "Room initialized":

            self.log.info(f"Collaborative chat server is listening for {data["room"]}")
            chat = await self.get_chat(data["room"])
            callback = partial(self.on_change, chat)
            chat.ymessages.observe(callback)

    async def get_chat(self, room_id: str) -> YChat:
        if COLLAB_VERSION == 3:
            collaboration = self.serverapp.web_app.settings["jupyter_server_ydoc"]
            document = await collaboration.get_document(
                room_id=room_id,
                copy=False
            )
        else:
            collaboration = self.serverapp.web_app.settings["jupyter_collaboration"]
            server = collaboration.ywebsocket_server

            room = await server.get_room(room_id)
            document = room._document
        return document

    def on_change(self, chat: YChat, events: ArrayEvent) -> None:
        for change in events.delta:
            if not "insert" in change.keys():
                continue
            messages = change["insert"]
            for message in messages:
                if message["sender"] == BOT["username"] or message["raw_time"]:
                    continue
                chat.create_task(
                    self.write_message(
                        chat,
                        f"Received:\n\n- **id**: *{message["id"]}*:\n\n- **body**: *{message["body"]}*")
                )

    async def write_message(self, chat: YChat, body: str) -> None:
        bot = chat.get_user_by_name(BOT["name"])
        if not bot:
            chat.set_user(BOT)
        else:
            BOT["username"] = bot["username"]

        chat.add_message({
            "type": "msg",
            "body": body,
            "id": str(uuid.uuid4()),
            "time": time.time(),
            "sender": BOT["username"],
            "raw_time": False
        })
