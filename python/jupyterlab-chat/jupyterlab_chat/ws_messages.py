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
                        | ClientMetadataMessage  # action="metadata"

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
from typing import Any, Literal


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
    sender: dict[str, Any] | None = None
    mentions: list[str] = field(default_factory=list)
    metadata: dict[str, Any] | None = None
    attachments: list[dict] | None = None
    mime_model: dict | None = None
    type: Literal["client"] = CLIENT
    action: Literal["send"] = "send"


@dataclass
class ClientEditMessage:
    """A web client asks the server to edit (or delete) an existing message."""

    id: str
    body: str | None = None
    deleted: bool | None = None
    edited: bool | None = None
    mime_model: dict | None = None
    mentions: list[str] | None = None
    metadata: dict[str, Any] | None = None
    attachments: list[dict] | None = None
    type: Literal["client"] = CLIENT
    action: Literal["edit"] = "edit"


@dataclass
class ClientMetadataMessage:
    """A web client asks the server to add/update chat-level metadata entries
    (e.g. the chat title)."""

    metadata: dict[str, Any]
    type: Literal["client"] = CLIENT
    action: Literal["metadata"] = "metadata"


ClientChatWsMessage = ClientSendMessage | ClientEditMessage | ClientMetadataMessage


# ---------------------------------------------------------------------------
# Server -> client
# ---------------------------------------------------------------------------
@dataclass
class ServerConnectionMessage:
    """First frame sent to a client: its id, the chat id, its (server-owned)
    identity, the full message history, and the current users map."""

    client_id: str
    id: str
    user: dict[str, Any]
    messages: list[dict]
    users: dict[str, dict]
    metadata: dict[str, Any]
    type: Literal["server"] = SERVER
    action: Literal["connection"] = "connection"


@dataclass
class ServerMessageMessage:
    """A new or updated message (already attachment-resolved)."""

    message: dict[str, Any]
    type: Literal["server"] = SERVER
    action: Literal["message"] = "message"


@dataclass
class ServerUsersMessage:
    """An add/update to the users map. Clients merge it into their local map."""

    users: dict[str, dict]
    type: Literal["server"] = SERVER
    action: Literal["users"] = "users"


@dataclass
class ServerMetadataMessage:
    """An add/update to the chat metadata map. Clients merge it in."""

    metadata: dict[str, Any]
    type: Literal["server"] = SERVER
    action: Literal["metadata"] = "metadata"


@dataclass
class ServerWritingMessage:
    """An ephemeral writing/typing status pushed by the server (e.g. an AI
    persona). Not persisted to the ``.chat`` file."""

    user: dict[str, Any]
    state: bool
    messageID: str | None = None
    typingIndicator: str | None = None
    type: Literal["server"] = SERVER
    action: Literal["writing"] = "writing"


ServerChatWsMessage = (
    ServerConnectionMessage
    | ServerMessageMessage
    | ServerUsersMessage
    | ServerMetadataMessage
    | ServerWritingMessage
)

ChatWsMessage = ClientChatWsMessage | ServerChatWsMessage


# ---------------------------------------------------------------------------
# Serialization / parsing
# ---------------------------------------------------------------------------
def to_wire(message: ServerChatWsMessage) -> str:
    """Serialize a server message to a JSON string, omitting ``None`` fields so
    optional keys are simply absent on the wire."""
    payload = {k: v for k, v in asdict(message).items() if v is not None}
    return json.dumps(payload)


def parse_client_message(data: Any) -> ClientChatWsMessage | None:
    """Validate and narrow a decoded client frame.

    Returns the typed message, or ``None`` if ``data`` is not a well-formed
    client frame (the caller logs and ignores it).
    """
    if not isinstance(data, dict) or data.get("type") != CLIENT:
        return None

    action = data.get("action")
    if action == "metadata":
        metadata = data.get("metadata")
        if not isinstance(metadata, dict):
            return None
        return ClientMetadataMessage(metadata=metadata)

    msg_id = data.get("id")
    if not isinstance(msg_id, str) or not msg_id:
        return None

    if action == "send":
        sender = data.get("sender")
        return ClientSendMessage(
            id=msg_id,
            body=data.get("body", "") or "",
            sender=(
                sender
                if isinstance(sender, dict)
                and isinstance(sender.get("username"), str)
                and sender["username"]
                else None
            ),
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
            mime_model=data.get("mime_model"),
            mentions=data.get("mentions"),
            metadata=data.get("metadata"),
            attachments=data.get("attachments"),
        )
    return None
