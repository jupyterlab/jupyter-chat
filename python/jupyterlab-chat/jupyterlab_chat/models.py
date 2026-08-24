# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
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


class ChatMessageAction(str, Enum):
    """The kind of message change surfaced to ``observe_messages`` callbacks."""

    CLIENT_MSG_RECEIVED = "client_msg_received"
    """A new message was received from a client (human user)."""

    CLIENT_MSG_EDITED = "client_msg_edited"
    """An existing message was edited by a client (human user)."""

    SERVER_MSG_SENT = "server_msg_sent"
    """A new message was sent from the server (e.g. an AI persona)."""

    SERVER_MSG_UPDATED = "server_msg_updated"
    """An existing server message was updated (e.g. a streaming response)."""


@dataclass
class ChatMessageEvent:
    """A single message change delivered to ``observe_messages`` callbacks."""

    action: ChatMessageAction
    """What happened to the message."""

    message: Message
    """The affected message (its current state)."""


MessageObserverCallback = Callable[["ChatMessageEvent"], None]
""" A callback invoked with a :class:`ChatMessageEvent` for each message change. """


@dataclass
class MessageObserver:
    """Opaque handle returned by :meth:`BaseChatModel.observe_messages`.

    The consumer MUST pass it back to :meth:`BaseChatModel.unobserve_messages`
    when it no longer wants updates; otherwise the underlying subscription (and
    the callback it references) leaks for the lifetime of the model.
    """

    _handle: Any = field(repr=False, compare=False)


class BaseChatModel(ABC):
    """
    Common interface implemented by both YChat (collaborative) and WsChatRoom
    (WebSocket-only), allowing trigger actions and bots to work identically
    regardless of the backend.
    """

    @abstractmethod
    def get_id(self) -> str:
        """Return the stable unique id of this chat. Always a string."""
        ...

    @abstractmethod
    def get_path(self) -> str:
        """Return the path of the file backing this chat model, relative to
        ``ContentsManager.root_dir``.
        """
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

    @abstractmethod
    def observe_messages(
        self, callback: MessageObserverCallback
    ) -> MessageObserver:
        """Register ``callback`` to be invoked with a :class:`ChatMessageEvent`
        for each message change.

        Returns a :class:`MessageObserver` handle; pass it to
        :meth:`unobserve_messages` to stop receiving updates and release the
        underlying subscription.
        """
        ...

    @abstractmethod
    def unobserve_messages(self, observer: MessageObserver) -> None:
        """Stop a message observer previously registered via
        :meth:`observe_messages`."""
        ...

    @abstractmethod
    def broadcast_writing_status(
        self,
        user: "User",
        status: Optional[dict] = None,
    ) -> None:
        """Broadcast an ephemeral "user is writing" status on behalf of ``user``.

        ``user`` is a :class:`User`, allowing server-side senders such as AI
        agents -- which each have their own user identity -- to advertise a
        typing indicator. ``status`` is ``None`` when the user stopped, or a
        mapping with optional ``messageID`` and ``typingIndicator`` keys.

        This is abstract: every transport MUST implement it so the writers API
        stays transport-complete. The WebSocket model relays a ``writing`` frame
        to connected clients; the collaborative (:class:`YChat`) model writes the
        status into the shared awareness channel. Both surface the writer through
        the same frontend ``writersChanged`` signal.
        """
        ...
