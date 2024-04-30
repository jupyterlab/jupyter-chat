# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# TODO: remove this module in favor of the one in jupyter_ydoc when released.

import json
import time
import asyncio
from functools import partial
from typing import Any, Callable, Dict, List, Set

from jupyter_ydoc.ybasedoc import YBaseDoc
from pycrdt import Map, MapEvent


class YChat(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._background_tasks: Set[asyncio.Task] = set()
        self._ydoc["users"] = self._yusers = Map()
        self._ydoc["messages"] = self._ymessages = Map()
        self._ymessages.observe(self._timestamp_new_messages)

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
    def users(self) -> Map:
        return self._yusers.to_py()

    def get_users(self) -> Dict:
        """
        Returns the users of the document.
        :return: Document's users.
        :rtype: string
        """

        users = self._yusers.to_py()
        return dict(users=users)

    @property
    def messages(self) -> Map:
        return self._ymessages.to_py()

    def get_messages(self) -> Dict:
        """
        Returns the messages of the document.
        :return: Document's messages.
        :rtype: string
        """

        messages = self._ymessages.to_py()
        return dict(messages=messages)

    def get(self) -> str:
        """
        Returns the contents of the document.
        :return: Document's contents.
        :rtype: string
        """

        return json.dumps({
            "messages": self.get_messages()["messages"],
            "users": self.get_users()["users"]
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
        if "users" in contents.keys():
            with self._ydoc.transaction():
                for k, v in contents["users"].items():
                    self._yusers.update({k: v})

        if "messages" in contents.keys():
            with self._ydoc.transaction():
                for k, v in contents["messages"].items():
                    self._ymessages.update({k: v})

    def observe(self, callback: Callable[[str, Any], None]) -> None:
        self.unobserve()
        self._subscriptions[self._ystate] = self._ystate.observe(partial(callback, "state"))
        self._subscriptions[self._ymessages] = self._ymessages.observe(
            partial(callback, "messages")
        )
        self._subscriptions[self._yusers] = self._yusers.observe(partial(callback, "users"))

    def _timestamp_new_messages(self, event: MapEvent) -> None:
        """
        Called when a the ymessages changes to update the timestamp with the server one,
        to synchronize all messages with a unique time server.
        """
        timestamp: float = time.time()
        new_msg_ids: List[str] = []
        for key, value in event.keys.items():
            if value["action"] != "add":
                continue
            message = self._ymessages.get(key, None)
            if message and message.get("raw_time", True):
                new_msg_ids.append(key)

        if len(new_msg_ids):
            self.create_task(self._set_timestamp(new_msg_ids, timestamp))

    async def _set_timestamp(self, new_msg_ids: List[str], timestamp: float):
        """
        Update the timestamp of a list of message.
        """
        messages = {}
        for msg_id in new_msg_ids:
            message = self._ymessages.get(msg_id, None)
            if message:
                message["time"] = timestamp
                message["raw_time"] = False
                messages[msg_id] = message

        with self._ydoc.transaction():
            self._ymessages.update(messages)
