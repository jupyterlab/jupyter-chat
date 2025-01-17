# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# TODO: remove this module in favor of the one in jupyter_ydoc when released.

from dataclasses import asdict
import json
import time
import asyncio
from functools import partial
from jupyter_ydoc.ybasedoc import YBaseDoc
from typing import Any, Callable, Optional, Set
from uuid import uuid4
from pycrdt import Array, ArrayEvent, Map, MapEvent

from .models import message_asdict_factory, Attachment, Message, NewMessage, User


class YChat(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._background_tasks: Set[asyncio.Task] = set()
        self.dirty = True
        self._ydoc["users"] = self._yusers = Map()  # type:ignore[var-annotated]
        self._ydoc["messages"] = self._ymessages = Array()  # type:ignore[var-annotated]
        self._ydoc["attachments"] = self._yattachments = Map()  # type:ignore[var-annotated]
        self._ydoc["metadata"] = self._ymetadata = Map()  # type:ignore[var-annotated]
        self._ymessages.observe(self._on_messages_change)

        # Observe the state to initialize the file as soon as the document is not dirty.
        self._ystate_subscription = self._ystate.observe(self._initialize)

        # Lookup table to get message index from its ID.
        self._indexes_by_id: dict[str, int] = {}

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

    def add_message(self, new_message: NewMessage) -> str:
        """
        Append a message to the document.
        """
        timestamp: float = time.time()
        uid = str(uuid4())
        message = Message(
            **asdict(new_message),
            time=timestamp,
            id=uid
        )

        with self._ydoc.transaction():
            index = len(self._ymessages) - next((i for i, v in enumerate(self._get_messages()[::-1]) if v["time"] < timestamp), len(self._ymessages))
            self._ymessages.insert(
                index,
                asdict(message, dict_factory=message_asdict_factory)
            )

        return uid

    def update_message(self, message: Message, append: bool = False):
        """
        Update a message of the document.
        If append is True, the content will be append to the previous content.
        """
        with self._ydoc.transaction():
            index = self._indexes_by_id[message.id]
            initial_message = self._ymessages[index]
            message.time = initial_message["time"]  # type:ignore[index]
            if append:
                message.body = initial_message["body"] + message.body  # type:ignore[index]
            self._ymessages[index] = asdict(message, dict_factory=message_asdict_factory)

    def get_attachments(self) -> dict[str, Attachment]:
        """
        Returns the attachments of the document.
        """
        return self._yattachments.to_py() or {}

    def set_attachment(self, attachment: Attachment):
        """
        Add or modify an attachments of the document.
        """
        attachment_id = str(uuid4())
        with self._ydoc.transaction():
            # Search if the attachment already exist to update it, otherwise add it.
            for id, att in self.get_attachments().items():
                if att.type == attachment.type and att.value == attachment.value:
                    attachment_id = id
                    break
            self._yattachments.update({attachment_id: asdict(attachment)})

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
                self._ymessages.extend(contents["messages"])

            if "metadata" in contents.keys():
                for k, v in contents["metadata"].items():
                    self._ymetadata.update({k: v})

    def observe(self, callback: Callable[[str, Any], None]) -> None:
        self.unobserve()
        self._subscriptions[self._ystate] = self._ystate.observe(partial(callback, "state"))
        self._subscriptions[self._ymetadata] = self._ymetadata.observe(
            partial(callback, "metadata")
        )
        self._subscriptions[self._ymessages] = self._ymessages.observe(
            partial(callback, "messages")
        )
        self._subscriptions[self._yusers] = self._yusers.observe(partial(callback, "users"))
        self._subscriptions[self._yattachments] = self._yattachments.observe(
            partial(callback, "attachments")
        )

    def _initialize(self, event: MapEvent) -> None:
        """
        Called when the state changes, to create an id if it does not exist.
        This function should be called only once when the dirty state is set to false.
        """
        if self.dirty:
            return
        if (self.get_id() is None):
            self.create_task(self.create_id())
        self._ystate.unobserve(self._ystate_subscription)

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
                message_dict = self._ymessages[msg_idx]
            except IndexError:
                return

            message_dict["time"] = timestamp  # type:ignore[index]
            message_dict["raw_time"] = False  # type:ignore[index]
            self._ymessages[msg_idx] = message_dict

            # Move the message at the correct position in the list, looking first at the end, since the message
            # should be the last one.
            # The next() function below return the index of the first message with a timestamp inferior of the
            # current one, starting from the end of the list.
            new_idx = len(self._ymessages) - next((i for i, v in enumerate(self._get_messages()[::-1]) if v["time"] < timestamp), len(self._ymessages))
            if msg_idx != new_idx:
                message_dict = self._ymessages.pop(msg_idx)
                self._ymessages.insert(new_idx, message_dict)
