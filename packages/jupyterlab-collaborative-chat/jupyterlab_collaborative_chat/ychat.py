# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# TODO: remove this module in favor of the one in jupyter_ydoc when released.

import json
import time
import asyncio
from functools import partial
from typing import Any, Callable, Dict, List, Set
from uuid import uuid4

from jupyter_ydoc.ybasedoc import YBaseDoc
from pycrdt import Array, ArrayEvent, Map, MapEvent


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
    def messages(self) -> List:
        return self._ymessages.to_py()

    @property
    def users(self) -> Map:
        return self._yusers.to_py()

    @property
    def metadata(self) -> Map:
        return self._ymetadata.to_py()

    def get_users(self) -> Dict:
        """
        Returns the users of the document.
        :return: Document's users.
        :rtype: string
        """

        users = self._yusers.to_py()
        return dict(users=users)

    def get_messages(self) -> Dict:
        """
        Returns the messages of the document.
        :return: Document's messages.
        :rtype: string
        """

        messages = self._ymessages.to_py()
        return dict(messages=messages)

    async def create_id(self) -> str:
        """
        Create a new ID for the document.
        """
        id = str(uuid4())
        self.set_id(id)
        return id

    def get_id(self) -> str:
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
        :return: Document's contents.
        :rtype: string
        """
        return json.dumps({
            "messages": self.messages,
            "users": self.users,
            "metadata": self.metadata
        })

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
        for value in event.delta:
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
            message = self._ymessages[idx]
            if message and message.get("raw_time", True):
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

            message["time"] = timestamp
            message["raw_time"] = False
            self._ymessages[msg_idx] = message

            # Move the message at the correct position in the list, looking first at the end, since the message
            # should be the last one.
            # The next() function below return the index of the first message with a timestamp inferior of the
            # current one, starting from the end of the list.
            new_idx = len(self._ymessages) - next((i for i, v in enumerate(self._ymessages.to_py()[::-1]) if v["time"] < timestamp), len(self._ymessages))
            if msg_idx != new_idx:
                message = self._ymessages.pop(msg_idx)
                self._ymessages.insert(new_idx, message)
