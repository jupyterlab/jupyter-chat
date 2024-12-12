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

from .models import message_asdict_factory, Message, User


class YChat(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._background_tasks: Set[asyncio.Task] = set()
        self.dirty = True
        self._ydoc["users"] = self._yusers = Map()
        self._ydoc["messages"] = self._ymessages = Array()
        self._ydoc["metadata"] = self._ymetadata = Map()
        self._ymessages.observe(self._timestamp_new_messages)

        # Observe the state to initialize the file as soon as the document is not dirty.
        self._ystate_subscription = self._ystate.observe(self._initialize)

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

    def get_message(self, id: str) -> tuple[Optional[Message], Optional[int]]:
        """
        Returns a message and its index from its id, or None.
        """
        return next(
            ((msg, i) for i, msg in enumerate(self.get_messages()) if msg.id == id),
            (None, None)
        )

    def get_messages(self) -> list[Message]:
        """
        Returns the messages of the document.
        """
        message_dicts = self._get_messages()
        return [Message(**message_dict) for message_dict in message_dicts]

    def _get_message_by_index(self, index: int):
        """
        Return a message from its index.
        """
        return self._ymessages[index]

    def _get_messages(self) -> list[dict]:
        """
        Returns the messages of the document as dict.
        """
        return self._ymessages.to_py() or []

    def add_message(self, message: Message) -> int:
        """
        Append a message to the document.
        """
        timestamp: float = time.time()
        message.time = timestamp
        with self._ydoc.transaction():
            index = len(self._ymessages) - next((i for i, v in enumerate(self._get_messages()[::-1]) if v["time"] < timestamp), len(self._ymessages))
            self._ymessages.insert(
                index,
                asdict(message, dict_factory=message_asdict_factory)
            )
            return index

    def update_message(self, message: Message, index: int, append: bool = False):
        """
        Update a message of the document.
        If append is True, the content will be append to the previous content.
        """
        with self._ydoc.transaction():
            initial_message: dict = self._ymessages.pop(index)
            if append:
                message.body = initial_message["body"] + message.body
            self._ymessages.insert(
                index,
                asdict(message, dict_factory=message_asdict_factory)
            )

    def set_message(self, message: Message, index: Optional[int] = None, append: bool = False) -> int:
        """
        Update or append a message.
        """
        initial_message: Optional[Message] = None
        if index is not None and 0 <= index < len(self._ymessages):
            initial_message = Message(**self._get_message_by_index(index))
        else:
            return self.add_message(message)

        if initial_message.id != message.id:
            initial_message, index = self.get_message(message.id)
            if index is None:
                return self.add_message(message)

        self.update_message(message, index, append)
        return index

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
            self._ymetadata.clear()
            for key in [k for k in self._ystate.keys() if k not in ("dirty", "path")]:
                del self._ystate[key]

            if "users" in contents.keys():
                for k, v in contents["users"].items():
                    self._yusers.update({k: v})

            if "messages" in contents.keys():
                for message in contents["messages"]:
                    self._ymessages.append(message)

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

    def _timestamp_new_messages(self, event: ArrayEvent) -> None:
        """
        Called when a the ymessages changes to update the timestamp with the server one,
        to synchronize all messages with a unique time server.
        """

        # Avoid updating the time while reading the document the first time, the dirty
        # flag is set to False after first reading.
        if self.dirty:
            return
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

        # There is no message inserted, nothing to do.
        if inserted_count == -1 or deleted_count == inserted_count:
            return

        for idx in range(index, index + inserted_count):
            message_dict = self._get_message_by_index(idx)
            if message_dict and message_dict.get("raw_time", True):
                self.create_task(self._set_timestamp(idx, timestamp))

    async def _set_timestamp(self, msg_idx: int, timestamp: float):
        """
        Update the timestamp of a message and reinsert it at the correct position.
        """
        with self._ydoc.transaction():
            # Remove the message from the list and modify the timestamp
            try:
                message_dict = self._get_message_by_index(msg_idx)
            except IndexError:
                return

            message_dict["time"] = timestamp
            message_dict["raw_time"] = False
            self._ymessages[msg_idx] = message_dict

            # Move the message at the correct position in the list, looking first at the end, since the message
            # should be the last one.
            # The next() function below return the index of the first message with a timestamp inferior of the
            # current one, starting from the end of the list.
            new_idx = len(self._ymessages) - next((i for i, v in enumerate(self._get_messages()[::-1]) if v["time"] < timestamp), len(self._ymessages))
            if msg_idx != new_idx:
                message_dict = self._ymessages.pop(msg_idx)
                self._ymessages.insert(new_idx, message_dict)
