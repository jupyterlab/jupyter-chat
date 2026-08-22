# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""
Chat lifecycle event schema (transport-agnostic).

Defines the Jupyter Events schema and the :class:`ChatEvent` dataclass emitted by
:class:`~jupyterlab_chat.chat_manager.ChatManager`. Every event carries the chat's
stable id (``chat_id`` = ``chat.get_id()``) -- the transport-neutral source of
truth for correlating a chat across events and transports. The RTC ``room_id`` is
never part of this schema: it is an RTC transport detail internal to the
ChatManager and to ``YChat`` (used only to recover the file id for path
resolution).

Under RTC, jupyter collaboration's room events are forwarded/parsed into this
schema by the ChatManager; under WebSocket, the handler notifies the manager
directly.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

#: Jupyter Events schema id for the generic (transport-agnostic) chat lifecycle bus.
CHAT_ROOM_EVENT_SCHEMA_ID = "https://schema.jupyter.org/jupyterlab_chat/room/v1"

#: jupyter_collaboration / JSD room event schema we forward from under RTC.
JUPYTER_COLLABORATION_EVENTS_URI = (
    "https://schema.jupyter.org/jupyter_collaboration/session/v1"
)

#: Inline schema (registered with the EventLogger at startup). Kept as a dict so
#: the package does not need to ship/locate a yaml resource.
CHAT_ROOM_EVENT_SCHEMA = {
    "$id": CHAT_ROOM_EVENT_SCHEMA_ID,
    "version": "1",
    "title": "Chat room and client events",
    "personal-data": True,
    "description": "Transport-agnostic chat room lifecycle and per-client connection events emitted by jupyterlab_chat.",
    "type": "object",
    "required": ["path", "action", "chat_id"],
    "properties": {
        "path": {
            "type": "string",
            "description": "Server-root-relative path of the .chat file.",
        },
        "action": {
            "enum": [
                "opened",
                "closed",
                "deleted",
                "client_connected",
                "client_disconnected",
            ],
            "description": (
                "Chat event action. 'opened'/'closed'/'deleted' are room-level "
                "(fire once when the chat goes live / is freed / is deleted). "
                "'client_connected'/'client_disconnected' fire per client and "
                "carry 'client_id'."
            ),
        },
        "chat_id": {
            "type": "string",
            "description": (
                "Stable, transport-neutral chat id (chat.get_id()); the source of "
                "truth for correlating a chat across events and transports. Always "
                "present on every event."
            ),
        },
        "client_id": {
            "type": "string",
            "description": "Per-connection id; present only for the client_* actions.",
        },
    },
    "additionalProperties": False,
}


class ChatEventAction(str, Enum):
    """Actions on the generic chat event bus."""

    OPENED = "opened"
    CLOSED = "closed"
    DELETED = "deleted"
    #: Fires for every client that connects to a chat (carries ``client_id``).
    CLIENT_CONNECTED = "client_connected"
    #: Fires for every client that disconnects from a chat (carries ``client_id``).
    CLIENT_DISCONNECTED = "client_disconnected"


@dataclass(frozen=True)
class ChatEvent:
    """A chat event. Emitted as JSON via Jupyter Events; this is the canonical
    shape (the registered schema mirrors it)."""

    path: str
    action: ChatEventAction
    #: Stable, transport-neutral chat id (``chat.get_id()``). Always present: the
    #: ChatManager only emits an event once it has resolved the chat's model, so
    #: consumers can rely on ``chat_id`` being set on every event.
    chat_id: str
    #: Set only for the ``client_connected``/``client_disconnected`` actions.
    client_id: Optional[str] = None

    def to_data(self) -> dict:
        data: dict = {
            "path": self.path,
            "action": self.action.value,
            "chat_id": self.chat_id,
        }
        if self.client_id is not None:
            data["client_id"] = self.client_id
        return data
