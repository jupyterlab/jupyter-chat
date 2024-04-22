# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# TODO: remove this module in favor of the one in jupyter_ydoc when released.

import json
from functools import partial
from typing import Any, Callable, Dict

from jupyter_ydoc.ybasedoc import YBaseDoc
from pycrdt import Map


class YChat(YBaseDoc):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._ydoc["users"] = self._yusers = Map()
        self._ydoc["messages"] = self._ymessages = Map()

    @property
    def version(self) -> str:
        """
        Returns the version of the document.
        :return: Document's version.
        :rtype: str
        """
        return "1.0.0"

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
