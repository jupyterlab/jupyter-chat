# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for the typed ``/api/chat/ws`` message schema."""
import json

from jupyterlab_chat.ws_messages import (
    ClientEditMessage,
    ClientSendMessage,
    ServerUsersMessage,
    ServerWritingMessage,
    parse_client_message,
    to_wire,
)


def test_to_wire_sets_discriminators_and_drops_none():
    frame = json.loads(to_wire(ServerUsersMessage(users={"a": {"username": "a"}})))
    assert frame == {"type": "server", "action": "users", "users": {"a": {"username": "a"}}}


def test_to_wire_omits_none_optionals():
    frame = json.loads(
        to_wire(ServerWritingMessage(user={"username": "bot"}, state=False))
    )
    # ``messageID``/``typingIndicator`` default to None and must be absent.
    assert frame == {
        "type": "server",
        "action": "writing",
        "user": {"username": "bot"},
        "state": False,
    }


def test_parse_client_send():
    msg = parse_client_message(
        {"type": "client", "action": "send", "id": "m1", "body": "hi"}
    )
    assert isinstance(msg, ClientSendMessage)
    assert msg.id == "m1" and msg.body == "hi" and msg.mentions == []


def test_parse_client_edit():
    msg = parse_client_message(
        {"type": "client", "action": "edit", "id": "m1", "deleted": True, "body": ""}
    )
    assert isinstance(msg, ClientEditMessage)
    assert msg.deleted is True and msg.body == ""


def test_parse_rejects_non_client_and_malformed():
    # Server-directed frames are not accepted from clients.
    assert parse_client_message({"type": "server", "action": "users"}) is None
    # Unknown action.
    assert parse_client_message({"type": "client", "action": "nope", "id": "x"}) is None
    # Missing/empty id.
    assert parse_client_message({"type": "client", "action": "send"}) is None
    assert parse_client_message({"type": "client", "action": "send", "id": ""}) is None
    # Not a dict.
    assert parse_client_message("garbage") is None
