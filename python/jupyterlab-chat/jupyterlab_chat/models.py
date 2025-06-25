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
    
    mentions: list[str] = field(default_factory=list)
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

    bot: Optional[bool] = False
    """ Boolean identifying if user is a bot """

    def __init__(self, *args, **kwargs):
        # ignore `mention_name` if passed
        kwargs.pop("mention_name", None)

        # set all attributes added here manually
        # required when overriding __init__() in a dataclass
        self.bot = kwargs.pop("bot", False)

        super().__init__(*args, **kwargs)

    @property
    def mention_name(self) -> str:
        """
        Returns the user's mention name.

        NOTE: This is a computed read-only property. The `mention_name`
        argument is ignored if passed in the constructor.
        """
        name: str = self.display_name or self.name or self.username
        name = name.replace(" ", "-")
        return name
    
    @mention_name.setter
    def mention_name(self, value: str) -> None:
        pass


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
