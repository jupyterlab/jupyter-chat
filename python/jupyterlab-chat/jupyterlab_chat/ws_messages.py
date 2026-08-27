# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Typed schema for the per-chat ``/api/chat/ws`` WebSocket protocol.

Every frame exchanged on the connection is one of the dataclasses defined here,
discriminated by two fields:

* ``type`` -- the *direction*: ``"client"`` (web client -> server) or
  ``"server"`` (server -> web client).
* ``action`` -- the specific message within a direction.

::

    ChatWsMessage    = ClientChatWsMessage | ServerChatWsMessage

    ClientChatWsMessage = ClientSendMessage      # action="send"
                        | ClientEditMessage      # action="edit"

    ServerChatWsMessage = ServerConnectionMessage  # action="connection"
                        | ServerMessageMessage     # action="message"
                        | ServerUsersMessage       # action="users"
                        | ServerMetadataMessage    # action="metadata"
                        | ServerWritingMessage     # action="writing"

The frontend mirrors this union in ``packages/jupyterlab-chat/src/ws-messages.ts``;
the two definitions must stay in sync.

Server frames are constructed as dataclasses and serialized with :func:`to_wire`
(which drops ``None`` fields so optional keys are simply absent on the wire).
Client frames are validated and narrowed by :func:`parse_client_message`.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union

#: Direction discriminator values (the ``type`` field).
CLIENT: Literal["client"] = "client"
SERVER: Literal["server"] = "server"


# ---------------------------------------------------------------------------
# Client -> server
# ---------------------------------------------------------------------------
@dataclass
class ClientSendMessage:
    """A web client asks the server to append a new message."""

    id: str
    body: str = ""
    mentions: List[str] = field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[dict]] = None
    mime_model: Optional[dict] = None
    type: Literal["client"] = CLIENT
    action: Literal["send"] = "send"


@dataclass
class ClientEditMessage:
    """A web client asks the server to edit (or delete) an existing message."""

    id: str
    body: Optional[str] = None
    deleted: Optional[bool] = None
    edited: Optional[bool] = None
    mentions: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[dict]] = None
    type: Literal["client"] = CLIENT
    action: Literal["edit"] = "edit"


ClientChatWsMessage = Union[ClientSendMessage, ClientEditMessage]


# ---------------------------------------------------------------------------
# Server -> client
# ---------------------------------------------------------------------------
@dataclass
class ServerConnectionMessage:
    """First frame sent to a client: its id, the chat id, its (server-owned)
    identity, the full message history, and the current users map."""

    client_id: str
    id: str
    user: Dict[str, Any]
    messages: List[dict]
    users: Dict[str, dict]
    type: Literal["server"] = SERVER
    action: Literal["connection"] = "connection"


@dataclass
class ServerMessageMessage:
    """A new or updated message (already attachment-resolved)."""

    message: Dict[str, Any]
    type: Literal["server"] = SERVER
    action: Literal["message"] = "message"


@dataclass
class ServerUsersMessage:
    """An add/update to the users map. Clients merge it into their local map."""

    users: Dict[str, dict]
    type: Literal["server"] = SERVER
    action: Literal["users"] = "users"


@dataclass
class ServerMetadataMessage:
    """An add/update to the chat metadata map. Clients merge it in."""

    metadata: Dict[str, Any]
    type: Literal["server"] = SERVER
    action: Literal["metadata"] = "metadata"


@dataclass
class ServerWritingMessage:
    """An ephemeral writing/typing status pushed by the server (e.g. an AI
    persona). Not persisted to the ``.chat`` file."""

    user: Dict[str, Any]
    state: bool
    messageID: Optional[str] = None
    typingIndicator: Optional[str] = None
    type: Literal["server"] = SERVER
    action: Literal["writing"] = "writing"


ServerChatWsMessage = Union[
    ServerConnectionMessage,
    ServerMessageMessage,
    ServerUsersMessage,
    ServerMetadataMessage,
    ServerWritingMessage,
]

ChatWsMessage = Union[ClientChatWsMessage, ServerChatWsMessage]


# ---------------------------------------------------------------------------
# Serialization / parsing
# ---------------------------------------------------------------------------
def to_wire(message: ServerChatWsMessage) -> str:
    """Serialize a server message to a JSON string, omitting ``None`` fields so
    optional keys are simply absent on the wire."""
    payload = {k: v for k, v in asdict(message).items() if v is not None}
    return json.dumps(payload)


def parse_client_message(data: Any) -> Optional[ClientChatWsMessage]:
    """Validate and narrow a decoded client frame.

    Returns the typed message, or ``None`` if ``data`` is not a well-formed
    client frame (the caller logs and ignores it).
    """
    if not isinstance(data, dict) or data.get("type") != CLIENT:
        return None
    msg_id = data.get("id")
    if not isinstance(msg_id, str) or not msg_id:
        return None

    action = data.get("action")
    if action == "send":
        return ClientSendMessage(
            id=msg_id,
            body=data.get("body", "") or "",
            mentions=list(data.get("mentions") or []),
            metadata=data.get("metadata"),
            attachments=data.get("attachments"),
            mime_model=data.get("mime_model"),
        )
    if action == "edit":
        return ClientEditMessage(
            id=msg_id,
            body=data.get("body"),
            deleted=data.get("deleted"),
            edited=data.get("edited"),
            mentions=data.get("mentions"),
            metadata=data.get("metadata"),
            attachments=data.get("attachments"),
        )
    return None
