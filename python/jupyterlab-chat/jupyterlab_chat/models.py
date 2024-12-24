# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from dataclasses import dataclass
from typing import Literal, Optional
from jupyter_server.auth import User as JupyterUser


def message_asdict_factory(data):
    """ Remove None values when converting Message to dict """
    return dict(x for x in data if x[1] is not None)


@dataclass
class Message:
    """ Object representing a message """

    # required arguments
    body: str
    """ The content of the message """

    id: str
    """ Unique ID """

    time: float
    """ Timestamp in second since epoch """

    sender: str
    """ The message sender unique id """

    # optional arguments, with defaults.
    #
    # These must be listed after all required arguments, unless `kw_only` is
    # specified in the `@dataclass` decorator. This can only be done once Python
    # 3.9 reaches EOL.
    type: Literal["msg"] = "msg"

    raw_time: Optional[bool] = None
    """
    Whether the timestamp is raw (from client) or not (from server, unified)
    Default to None
    """

    deleted: Optional[bool] = None
    """
    Whether the message has been deleted or not (body should be empty if True)
    Default to None.
    """

    edited: Optional[bool] = None
    """
    Whether the message has been edited or not
    Default to None.
    """


@dataclass
class NewMessage:
    """ Object representing a new message """

    body: str
    """ The content of the message """

    sender: str
    """ The message sender unique id """


@dataclass
class User(JupyterUser):
    """ Object representing a user (same as Jupyter User ) """
