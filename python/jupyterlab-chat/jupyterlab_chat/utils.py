# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Utility functions for jupyter-chat."""

import re
from typing import TYPE_CHECKING, Set

if TYPE_CHECKING:
    from .models import Message
    from .ychat import YChat


def find_mentions_callback(message: "Message", chat: "YChat") -> None:
    """
    Callback to extract and update mentions in a message.

    Finds all @mentions in the message body and updates the message's mentions list
    with the corresponding usernames.

    Args:
        message: The message object to update
        chat: The YChat instance for accessing user data
    """
    mention_pattern = re.compile(r"@([\w-]+):?")
    mentioned_names: Set[str] = set(re.findall(mention_pattern, message.body))
    users = chat.get_users()
    mentioned_usernames = []
    for username, user in users.items():
        if user.mention_name in mentioned_names and user.username not in mentioned_usernames:
            mentioned_usernames.append(username)

    message.mentions = mentioned_usernames
