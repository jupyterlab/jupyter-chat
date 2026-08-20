# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# TODO: remove this module in favor of the one in jupyter_ydoc when released.

from dataclasses import asdict
import json
import time
import asyncio
from functools import partial
from jupyter_ydoc.ybasedoc import YBaseDoc
from typing import Any, Callable, Optional, Set, Union
from uuid import uuid4
from pycrdt import Array, ArrayEvent, Map, MapEvent, Subscription

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
from .utils import find_mentions

# Awareness state field under which the collaborative model publishes the set of
# users currently writing (e.g. AI personas). Server-side senders have no
# awareness client of their own, so rather than fake a client per writer, the
# whole set is published as a list under the document's own awareness slot and
# clients scan every slot for this field. See `onAwarenessChange` in the
# frontend model.
WRITERS_AWARENESS_KEY = "writers"


class YChat(YBaseDoc, BaseChatModel):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._background_tasks: Set[asyncio.Task] = set()
        self.dirty = True
        self._ydoc["users"] = self._yusers = Map()  # type:ignore[var-annotated]
        self._ydoc["messages"] = self._ymessages = Array()  # type:ignore[var-annotated]
        self._ydoc["attachments"] = self._yattachments = Map()  # type:ignore[var-annotated]
        self._ydoc["metadata"] = self._ymetadata = Map()  # type:ignore[var-annotated]
        self._ymessages_subscription: Optional[Subscription] = self._ymessages.observe(
            self._on_messages_change
        )

        # Observe the state to initialize the file as soon as the document is not dirty.
        self._ystate_subscription: Optional[Subscription] = self._ystate.observe(
            self._initialize
        )

        # Lookup table to get message index from its ID.
        self._indexes_by_id: dict[str, int] = {}

        # In-memory set of users currently writing (keyed by username), the
        # source of truth published to the awareness channel. Ephemeral.
        self._writers: dict[str, dict] = {}

    @property
    def version(self) -> str:
        """
        Returns the version of the document.
        :return: Document's version.
        :rtype: str
        """
        return "1.0.0"

    def create_task(self, coro):
        task = asyncio.create_task(coro)
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    @property
    def ymessages(self) -> Array:
        return self._ymessages

    @property
    def yusers(self) -> Map:
        return self._yusers

    @property
    def yattachments(self) -> Map:
        return self._yattachments

    @property
    def ymetadata(self) -> Map:
        return self._ymetadata

    def get_user(self, username: str) -> Optional[User]:
        """
        Returns a user from its id, or None
        """
        return self.get_users().get(username, None)

    def get_user_by_name(self, name: str) -> Optional[User]:
        """
        Returns a user from its name property, or None.
        """
        return next(
            (user for user in self.get_users().values() if user.name == name),
            None
        )

    def get_users(self) -> dict[str, User]:
        """
        Returns the users of the document.
        :return: Document's users.
        """
        user_dicts = self._get_users()
        return {username: User(**user_dict) for username, user_dict in user_dicts.items()}

    def _get_users(self) -> dict[str, dict]:
        """
        Returns the users of the document as dict.
        """
        return self._yusers.to_py() or {}

    def set_user(self, user: User) -> None:
        """
        Adds or modifies a user.
        """
        with self._ydoc.transaction():
            self._yusers.update({
                user.username: asdict(user)
            })

    def get_message(self, id: str) -> Optional[Message]:
        """
        Returns a message and its index from its id, or None.
        """
        if not id in self._indexes_by_id:
            return None
        index = self._indexes_by_id[id]
        return Message(**self._ymessages[index])  # type:ignore[arg-type]

    def get_messages(self) -> list[Message]:
        """
        Returns the messages of the document.
        """
        message_dicts = self._get_messages()
        return [Message(**message_dict) for message_dict in message_dicts]

    def _get_messages(self) -> list[dict]:
        """
        Returns the messages of the document as dict.
        """
        return self._ymessages.to_py() or []

    def add_message(self, new_message: NewMessage, trigger_actions: list[Callable] | None = None) -> str:
        """
        Append a message to the document.

        Args:
            new_message: The message to add
            trigger_actions: List of callbacks to execute on the message. Defaults to [find_mentions].
                           Each callback receives (message, chat) as arguments.
        """
        if trigger_actions is None:
            trigger_actions = [find_mentions]

        timestamp: float = time.time()
        uid = str(uuid4())
        message = Message(
            **asdict(new_message),
            time=timestamp,
            id=uid,
        )

        # Execute all trigger action callbacks
        for callback in trigger_actions:
            callback(message, self)

        with self._ydoc.transaction():
            index = len(self._ymessages) - next((i for i, v in enumerate(self._get_messages()[::-1]) if v["time"] < timestamp), len(self._ymessages))
            self._ymessages.insert(
                index,
                Map(asdict(message, dict_factory=message_asdict_factory))
            )

        return uid

    def update_message(self, update: Message, append: bool = False, trigger_actions: list[Callable] | None = None):
        """
        Update a message of the document.

        Args:
            update: The updated message
            append: If True, the content will be appended to the previous content
            trigger_actions: List of callbacks to execute on the message. Each callback receives (message, chat) as arguments.
        """
        with self._ydoc.transaction():
            try:
                index = self._indexes_by_id[update.id]
                message = self._ymessages[index]
            except (KeyError, IndexError) as e:
                print(f"Error while updating the message:\n{e}")
                return

            if (update.body and append):
                update.body = message.get("body") + update.body

            # Execute all trigger action callbacks
            if trigger_actions:
                for callback in trigger_actions:
                    callback(update, self)

            update_dict = asdict(update)
            # Only update the changed values.
            for key in update_dict:
                if key in message:
                    if message[key] != update_dict[key]:
                        message.update({ key: update_dict[key] })
                elif update_dict[key] is not None:
                    message.update({ key: update_dict[key] })

    def get_attachments(self) -> dict[str, Union[FileAttachment, NotebookAttachment]]:
        """
        Returns all attachments in the chat as a dictionary, indexed by
        attachment ID.
        """
        return self._yattachments.to_py() or {}

    def set_attachment(self, attachment: Union[FileAttachment, NotebookAttachment]) -> str:
        """
        Add or modify an attachment in the chat, and returns the ID of the
        attachment.

        NOTE: This method does not add an attachment to any message. It merely
        adds the attachment data to the chat file and returns an attachment ID.
        To add an attachment to a new message, consumers should call this method
        & add the returned ID to `NewMessage.attachments`.
        """
        # Use the existing ID if the attachment already exists, otherwise create
        # a new ID
        attachment_json = json.dumps(asdict(attachment), sort_keys=True)
        attachment_id = None
        for id, att in self.get_attachments().items():
            if json.dumps(att, sort_keys=True) == attachment_json:
                attachment_id = id
                break
        if not attachment_id:
            attachment_id = str(uuid4())

        # Update the attachment with the computed ID, then return the ID
        with self._ydoc.transaction():
            self._yattachments.update({attachment_id: asdict(attachment)})
        return attachment_id

    def get_metadata(self) -> dict[str, Any]:
        """
        Returns the metadata of the document.
        """
        return self._ymetadata.to_py() or {}

    def set_metadata(self, name: str, metadata: Any):
        """
        Adds or modifies a metadata of the document.
        """
        with self._ydoc.transaction():
            self._ymetadata.update({name: metadata})

    def broadcast_writing_status(
        self,
        user: User,
        status: Optional[dict] = None,
    ) -> None:
        """Broadcast ``user``'s writing status over the awareness channel.

        ``user`` is a :class:`User`, serialized with ``dataclasses.asdict()`` so
        every field (including ``bot``) survives to the client. ``status`` is
        ``None`` when the user stopped, or a mapping with optional
        ``messageID``/``typingIndicator`` keys. The full set of writers is
        published as a list under the document's own awareness slot (the field
        named by :data:`WRITERS_AWARENESS_KEY`), which every client scans; the
        awareness channel keeps that slot alive on its own, so no per-writer
        client or heartbeat is needed. Ephemeral: never persisted to the
        ``.chat`` document.
        """
        if status is None:
            self._writers.pop(user.username, None)
        else:
            writer: dict = {"user": asdict(user)}
            message_id = status.get("messageID")
            if message_id is not None:
                writer["messageID"] = message_id
            typing_indicator = status.get("typingIndicator")
            if typing_indicator is not None:
                writer["typingIndicator"] = typing_indicator
            self._writers[user.username] = writer
        self._publish_writers()

    def _publish_writers(self) -> None:
        """Publish the current writer set to the awareness channel.

        Writes to the document's own awareness slot (no client-ID juggling). A
        no-op until the document is attached to a collaboration room, which is
        always the case when a server-side sender writes.
        """
        if self.awareness is None:
            return
        self.awareness.set_local_state_field(
            WRITERS_AWARENESS_KEY, list(self._writers.values())
        )

    def observe_messages(
        self, callback: MessageObserverCallback
    ) -> MessageObserver:
        """Observe new messages by subscribing to the shared messages array.

        Only genuine new messages (array inserts) are surfaced; in-place content
        edits mutate a nested map and do not raise an array event, so
        ``CLIENT_MSG_EDITED``/``SERVER_MSG_UPDATED`` are not emitted in RTC mode.
        New messages are classified as server-sent when their sender is a bot
        user, and client-received otherwise.
        """
        subscription: Subscription = self._ymessages.observe(
            partial(self._dispatch_message_event, callback)
        )
        return MessageObserver(_handle=subscription)

    def unobserve_messages(self, observer: MessageObserver) -> None:
        subscription = observer._handle
        if subscription is not None:
            self._ymessages.unobserve(subscription)

    def _dispatch_message_event(
        self, callback: MessageObserverCallback, event: ArrayEvent
    ) -> None:
        # Skip while the document is still loading its pre-existing messages,
        # and skip events that contain a delete (a message reposition performed
        # by `_set_timestamp` is a delete+insert of an existing message, not a
        # new one).
        if self.dirty:
            return
        if any("delete" in value.keys() for value in event.delta):  # type:ignore[attr-defined]
            return
        for value in event.delta:  # type:ignore[attr-defined]
            if "insert" not in value.keys():
                continue
            for item in value["insert"]:
                message = Message(**item.to_py())
                sender = self.get_user(message.sender)
                action = (
                    ChatMessageAction.SERVER_MSG_SENT
                    if sender is not None and sender.bot
                    else ChatMessageAction.CLIENT_MSG_RECEIVED
                )
                callback(ChatMessageEvent(action=action, message=message))

    async def create_id(self) -> str:
        """
        Creates a new ID for the document.
        """
        id = str(uuid4())
        self.set_id(id)
        return id

    def get_id(self) -> Optional[str]:
        """
        Returns the ID of the document.
        """
        return self._ymetadata.get("id", None)

    def set_id(self, id: str) -> None:
        """
        Set the ID of the document
        """
        with self._ydoc.transaction():
            self._ymetadata.update({"id": id})

    def get(self) -> str:
        """
        Returns the contents of the document.
        :return: Document's contents in JSON.
        """
        return json.dumps(
            {
                "messages": self._get_messages(),
                "users": self._get_users(),
                "attachments": self.get_attachments(),
                "metadata": self.get_metadata()
            },
            indent=2
        )

    def set(self, value: str) -> None:
        """
        Sets the content of the document.
        :param value: The content of the document.
        :type value: str
        """
        try:
            contents = json.loads(value)
        except json.JSONDecodeError:
            contents = dict()

        # Make sure the users are updated before the messages, for consistency.
        with self._ydoc.transaction():
            self._yusers.clear()
            self._ymessages.clear()
            self._yattachments.clear()
            self._ymetadata.clear()
            for key in [k for k in self._ystate.keys() if k not in ("dirty", "path")]:
                del self._ystate[key]

            if "users" in contents.keys():
                for k, v in contents["users"].items():
                    self._yusers.update({k: v})

            if "attachments" in contents.keys():
                for k, v in contents["attachments"].items():
                    self._yattachments.update({k: v})

            if "messages" in contents.keys():
                self._ymessages.extend([Map(message) for message in contents["messages"]])

            if "metadata" in contents.keys():
                for k, v in contents["metadata"].items():
                    self._ymetadata.update({k: v})

    def observe(self, callback: Callable[[str, Any], None]) -> None:
        # Only clear the subscriptions registered by a previous observe() call;
        # the observers registered in __init__ must persist for the lifetime of
        # the document (they are removed by unobserve() at teardown).
        super().unobserve()
        self._subscriptions[self._ystate] = self._ystate.observe(partial(callback, "state"))
        self._subscriptions[self._ymetadata] = self._ymetadata.observe(
            partial(callback, "metadata")
        )
        self._subscriptions[self._ymessages] = self._ymessages.observe_deep(
            partial(callback, "messages")
        )
        self._subscriptions[self._yusers] = self._yusers.observe(partial(callback, "users"))
        self._subscriptions[self._yattachments] = self._yattachments.observe(
            partial(callback, "attachments")
        )

    def unobserve(self) -> None:
        """
        Unsubscribes to document changes.

        In addition to the subscriptions registered via ``observe()`` (removed by
        the base class), this removes the observers registered in ``__init__()``.
        Those callbacks are bound methods that hold a reference to ``self``, so
        leaving them registered would prevent the ``YChat`` from being garbage
        collected.
        """
        super().unobserve()
        if self._ymessages_subscription is not None:
            self._ymessages.unobserve(self._ymessages_subscription)
            self._ymessages_subscription = None
        if self._ystate_subscription is not None:
            self._ystate.unobserve(self._ystate_subscription)
            self._ystate_subscription = None

    def _initialize(self, event: MapEvent) -> None:
        """
        Called when the state changes, to create an id if it does not exist.
        This function should be called only once when the dirty state is set to false.
        """
        if self.dirty:
            return
        if (self.get_id() is None):
            self.create_task(self.create_id())
        if self._ystate_subscription is not None:
            self._ystate.unobserve(self._ystate_subscription)
            self._ystate_subscription = None

    def _on_messages_change(self, event: ArrayEvent) -> None:
        """
        Called when a the ymessages changes.
        It updates the lookup table, and updates the timestamp of new message with the
        server one, to synchronize all messages with a unique time server.
        """

        timestamp: float = time.time()
        index = 0
        inserted_count = -1
        deleted_count = -1
        for value in event.delta:  # type:ignore[attr-defined]
            if "retain" in value.keys():
                index = value["retain"]
            elif "insert" in value.keys():
                inserted_count = len(value["insert"])
            elif "delete" in value.keys():
                deleted_count = value["delete"]

        # Update the message indexes
        if deleted_count <= 0 and index + inserted_count == len(self._ymessages):
            # Messages are added to the end
            for idx in range(index, index + inserted_count):
                self._indexes_by_id[self._ymessages[idx]["id"]] = idx  # type:ignore[index]
        elif deleted_count != inserted_count:
            # Some messages may have been inserted or deleted, the indexes should be
            # restored. When the count are equals, it should be a message update without
            # changing the index.
            self._indexes_by_id = {message["id"]: idx for idx, message in enumerate(self._get_messages())}

        # Avoid updating the timestamp when reading the document the first time (dirty
        # flag set to True)or when there is no new message.
        if self.dirty or inserted_count == -1 or deleted_count == inserted_count:
            return

        for idx in range(index, index + inserted_count):
            message_dict = self._ymessages[idx]
            if message_dict and message_dict.get("raw_time", True):  # type:ignore[attr-defined]
                self.create_task(self._set_timestamp(idx, timestamp))

    async def _set_timestamp(self, msg_idx: int, timestamp: float):
        """
        Update the timestamp of a message and reinsert it at the correct position.
        """
        with self._ydoc.transaction():
            # Remove the message from the list and modify the timestamp
            try:
                message = self._ymessages[msg_idx]
            except IndexError:
                return

            message.update({"time": timestamp, "raw_time": False})  # type:ignore[index]

            # Move the message at the correct position in the list, looking first at the end, since the message
            # should be the last one.
            # The next() function below return the index of the first message with a timestamp inferior of the
            # current one, starting from the end of the list.
            new_idx = len(self._ymessages) - next((i for i, v in enumerate(self._get_messages()[::-1]) if v.get("time", 0) < timestamp), len(self._ymessages))
            if msg_idx != new_idx:
                message = self._ymessages.pop(msg_idx)
                self._ymessages.insert(new_idx, message)
