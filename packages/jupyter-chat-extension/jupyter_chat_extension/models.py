from typing import Any, Dict, List, Literal, Optional, Union

from langchain.pydantic_v1 import BaseModel, validator

DEFAULT_CHUNK_SIZE = 2000
DEFAULT_CHUNK_OVERLAP = 100


# the type of message used to chat with the agent
class ChatRequest(BaseModel):
    body: str
    id: str


class ChatUser(BaseModel):
    # User ID assigned by IdentityProvider.
    username: str
    initials: Optional[str]
    name: Optional[str]
    display_name: Optional[str]
    color: Optional[str]
    avatar_url: Optional[str]


class ChatClient(ChatUser):
    # A unique client ID assigned to identify different JupyterLab clients on
    # the same device (i.e. running on multiple tabs/windows), which may have
    # the same username assigned to them by the IdentityProvider.
    id: str


class ChatMessage(BaseModel):
    type: Literal["msg"] = "msg"
    id: str
    time: float
    body: str
    sender: ChatClient


class ConnectionMessage(BaseModel):
    type: Literal["connection"] = "connection"
    client_id: str


class ClearMessage(BaseModel):
    type: Literal["clear"] = "clear"


Message = Union[ChatMessage, ConnectionMessage, ClearMessage]


class ChatHistory(BaseModel):
    """History of chat messages"""

    messages: List[ChatMessage]


class DescribeConfigResponse(BaseModel):
    send_with_shift_enter: bool
    # timestamp indicating when the configuration file was last read. should be
    # passed to the subsequent UpdateConfig request.
    last_read: int


def forbid_none(cls, v):
    assert v is not None, "size may not be None"
    return v


class UpdateConfigRequest(BaseModel):
    send_with_shift_enter: Optional[bool]
    # if passed, this will raise an Error if the config was written to after the
    # time specified by `last_read` to prevent write-write conflicts.
    last_read: Optional[int]

    _validate_send_wse = validator("send_with_shift_enter", allow_reuse=True)(
        forbid_none
    )


class GlobalConfig(BaseModel):
    """Model used to represent the config by ConfigManager. This is exclusive to
    the backend and should never be sent to the client."""

    send_with_shift_enter: bool
