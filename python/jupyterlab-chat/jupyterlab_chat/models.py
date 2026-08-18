# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Optional, Tuple, Union
from jupyter_server.auth import User as JupyterUser


def message_asdict_factory(data):
    """ Remove None values when converting Message to dict """
    return dict(x for x in data if x[1] is not None)


@dataclass(kw_only=True)
class MimeModel:
    """ Model of the mime data """

    data: dict[str, Any]
    """ The data containing the mime bundles. """

    metadata: Optional[dict] = None
    """ The metadata associated to the mime bundle. """

    trusted: Optional[bool] = None
    """ Whether the data is trusted """


@dataclass(kw_only=True)
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

    metadata: Optional[dict] = None
    """ Optional metadata attached to this message. """

    mime_model: Optional[MimeModel] = None
    """
    Optional mime model data.
    If provided, it should be prioritized over the body.
    """


@dataclass(kw_only=True)
class NewMessage:
    """ Object representing a new message """

    body: str
    """ The content of the message """

    sender: str
    """ The message sender unique id """

    mime_model: Optional[MimeModel] = None
    """
    Optional mime model data.
    If provided, it should be prioritized over the body.
    """

@dataclass(kw_only=True)
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

@dataclass(kw_only=True)
class AttachmentSelection:
    start: Tuple[int, int]
    """
    The line number & column number of where the selection begins (inclusive).
    """

    end: Tuple[int, int]
    """
    The line number & column number of where the selection ends (inclusive).
    """

    content: str
    """
    The initial content of the selection.
    """

@dataclass(kw_only=True)
class FileAttachment:
    """
    Model of a file attachment.

    The corresponding frontend model is `IFileAttachment`.
    """

    value: str
    """
    The path to the file, relative to `ContentsManager.root_dir`.
    """

    type: Literal['file'] = 'file'

    mimetype: Optional[str] = None
    """
    (optional) The mime type of the file. Defaults to `None`.
    """

    selection: Optional[AttachmentSelection] = None
    """
    (optional) A selection range within the file. See `AttachmentSelection` for
    more info.
    """

@dataclass(kw_only=True)
class NotebookAttachmentCell:
    """
    Model of a single cell within a notebook attachment.

    The corresponding frontend model is `INotebookAttachmentCell`.
    """

    id: str
    """
    The ID of the cell within the notebook.
    """

    input_type: Literal["raw", "markdown", "code"]
    """
    The type of the cell.
    """

    selection: Optional[AttachmentSelection] = None
    """
    (optional) A selection range within the cell. See `AttachmentSelection` for
    more info.
    """

@dataclass(kw_only=True)
class NotebookAttachment:
    """
    Model of a notebook attachment.

    The corresponding frontend model is `INotebookAttachment`.
    """

    value: str
    """
    The local path of the notebook, relative to `ContentsManager.root_dir`.
    """

    type: Literal['notebook'] = 'notebook'

    mimetype: Optional[str] = None
    """
    (optional) The mime type of the notebook. Defaults to `None`.
    """

    cells: Optional[list[NotebookAttachmentCell]] = None
    """
    (optional) A list of cells in the notebook.
    """


class BaseChatModel(ABC):
    """
    Common interface implemented by both YChat (collaborative) and WsChatRoom
    (WebSocket-only), allowing trigger actions and bots to work identically
    regardless of the backend.
    """

    @abstractmethod
    def get_id(self) -> Optional[str]:
        ...

    @abstractmethod
    def get_message(self, id: str) -> Optional[Message]:
        ...

    @abstractmethod
    def get_messages(self) -> list[Message]:
        ...

    @abstractmethod
    def get_users(self) -> dict[str, User]:
        ...

    @abstractmethod
    def get_metadata(self) -> dict[str, Any]:
        ...

    @abstractmethod
    def get_attachments(self) -> dict[str, Union[FileAttachment, NotebookAttachment]]:
        ...

    @abstractmethod
    def add_message(
        self,
        new_message: NewMessage,
        trigger_actions: list[Callable] | None = None,
    ) -> str:
        ...

    @abstractmethod
    def update_message(
        self,
        update: Message,
        append: bool = False,
        trigger_actions: list[Callable] | None = None,
    ) -> None:
        ...

    @abstractmethod
    def set_attachment(
        self, attachment: Union[FileAttachment, NotebookAttachment]
    ) -> str:
        ...

    @abstractmethod
    def set_user(self, user: User) -> None:
        ...

    @abstractmethod
    def set_metadata(self, name: str, metadata: Any) -> None:
        ...

    def broadcast_writing_status(
        self,
        user: Union["User", dict],
        status: Optional[dict] = None,
    ) -> None:
        """Broadcast an ephemeral "user is writing" status on behalf of ``user``.

        ``user`` is a :class:`User` (or a mapping with at least ``username``),
        allowing server-side senders such as AI agents -- which each have their
        own user identity -- to advertise a typing indicator. ``status`` is
        ``None`` when the user stopped, or a mapping with optional ``messageID``
        and ``typingIndicator`` keys.

        The default implementation is a no-op; transports that support live
        presence (e.g. the WebSocket model) override it.
        """
        # no-op by default
