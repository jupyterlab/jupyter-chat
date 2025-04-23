# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from dataclasses import dataclass, field
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

    attachments: Optional[list[str]] = None
    """ The message attachments, a list of attachment ID """
    
    mentions: Optional[list[str]] = field(default_factory=list)
    """ Users mentioned in the message """

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
    """ Object representing a user """

    mention_name: Optional[str] = None
    """ The string to use as mention in chat """

    bot: Optional[bool] = None
    """ Boolean identifying if user is a bot """


@dataclass
class Attachment:
    """ Object representing an attachment """

    type: str
    """ The type of attachment (i.e. "file", "variable", "image") """

    value: str
    """ The value (i.e. a path, a variable name, an image content) """

    mimetype: Optional[str] = None
    """
    The mime type of the attachment
    Default to None.
    """
