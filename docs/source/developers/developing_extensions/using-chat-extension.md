# Using a chat extension in another extension

The chat extension depends on [jupyter collaboration](https://jupyterlab-realtime-collaboration.readthedocs.io/en/latest/index.html)
to exchange the messages.

As a very brief summary, jupyter collaboration allows jupyterlab users to share a
document in real time, based on
[CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type). Any change
made to the document is propagated to all users. These changes can occur from the
frontend or from the backend. The shared document has an object representation in
Typescript (for the frontend) and in Python (for the backend). These representations
can be accessed and used by external extensions.

## Exposed token

`jupyterlab-chat` expose several tokens that allow external extensions to
interact with.

### IChatFactory

This token is composed of:

- `widgetConfig` object, to retrieve and change the current [settings](#chat-settings)
  of all the chats
- `tracker`, a widget tracker that allows to track all the opened chats, and to
  retrieve the current one.

### IChatPanel

This token is a pointer to the left panel containing chats.\
It can be used to programmatically open chat in the panel for example, or to list the
opened chats.

## Interact with the chat from the backend

`jupyter_collaboration` provides a websocket server to handle every shared document
on the server side. This websocket server allows to retrieve a shared document.

In addition, when a shared document is created, an event is emitted. We can use that
event to trigger a connection to the shared document.

Here's an example of a server extension that responds to every message received in one
of the chats:

```python
import jupyter_collaboration
import time
import uuid
from functools import partial
from jupyterlab_chat.models import Message
from jupyterlab_chat.ychat import YChat
from jupyter_collaboration.utils import JUPYTER_COLLABORATION_EVENTS_URI
from jupyter_events import EventLogger
from jupyter_server.extension.application import ExtensionApp
from pycrdt import ArrayEvent


if int(jupyter_collaboration.__version__[0]) >= 3:
    COLLAB_VERSION = 3
else:
    COLLAB_VERSION = 2

USER = {
    "username": str(uuid.uuid4()),
    "name": "user",
    "display_name": "User"
}


class MyExtension(ExtensionApp):
    name = "my_extension"
    app_name = "My Extension"
    description = """
    this extension interact with chats
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

            self.log.info(f"Chat server is listening for {data["room"]}")
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
            if "insert" not in change.keys():
                continue
            messages = [Message(**m.to_py()) for m in change["insert"]]
            for message in messages:
                if message.sender == USER["username"]:
                    continue
                chat.create_task(
                    self.write_message(
                        chat,
                        f"Received:\n\n- **id**: *{message.id}*:\n\n- **body**: *{message.body}*")
                )

    async def write_message(self, chat: YChat, body: str) -> None:
        bot = chat.get_user_by_name(USER["name"])
        if not bot:
            chat.set_user(USER)
        else:
            USER["username"] = bot["username"]

        chat.add_message({
            "body": body,
            "sender": USER["username"]
        })

```
