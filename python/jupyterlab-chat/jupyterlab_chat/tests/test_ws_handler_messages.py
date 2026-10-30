# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for WSChatHandler message handling:
- custom sender (frontend agent / bot) is auto-registered on first send
- mime_model updates are applied and broadcast
"""
import json
import logging
from types import SimpleNamespace

from jupyterlab_chat.models import User
from jupyterlab_chat.websocket_handler import WSChatHandler
from jupyterlab_chat.websocket_model import WsChatModel
from jupyterlab_chat.ws_messages import ClientEditMessage, ClientSendMessage

# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------

_ALICE = SimpleNamespace(
    username="alice",
    name="Alice",
    display_name="Alice",
    initials="A",
    color=None,
    avatar_url=None,
)


class _FakeClient:
    """Captures frames written to a connected client."""

    def __init__(self):
        self.messages = []

    def write_message(self, message):
        self.messages.append(message)


class _HandlerStub(WSChatHandler):
    """Minimal stub: bypasses Tornado init, exposes current_user for tests."""

    def __init__(self, model, fake_client):
        self._model = model
        self._fake_client = fake_client
        model.handlers["client-1"] = fake_client  # type: ignore[assignment]

    @property  # type: ignore[misc]
    def current_user(self):
        return _ALICE

    @property
    def log(self):
        return logging.getLogger("test")


def _setup(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    client = _FakeClient()
    handler = _HandlerStub(model, client)
    return model, client, handler


def _frames_of(client, action):
    return [
        json.loads(m)
        for m in client.messages
        if json.loads(m).get("type") == "server"
        and json.loads(m).get("action") == action
    ]

# Default sender
def test_no_sender_field_falls_back_to_authenticated_user(tmp_path):
    """A message without a sender field is attributed to the authenticated user."""
    model, client, handler = _setup(tmp_path)
    msg = ClientSendMessage(id="m1", body="plain message")

    handler._handle_new_message(msg, model)

    stored = model.get_message("m1")
    assert stored is not None
    assert stored.sender == "alice"

# Custom frontend sender
def test_custom_sender_is_registered_in_users(tmp_path):
    """A message sent with a custom sender registers the sender in the users map."""
    model, client, handler = _setup(tmp_path)
    msg = ClientSendMessage(
        id="m1",
        body="hello",
        sender={"username": "agent", "name": "Agent", "display_name": "My Agent", "bot": True},
    )

    handler._handle_new_message(msg, model)

    assert "agent" in model._users
    assert model._users["agent"]["bot"] is True
    assert model._users["agent"]["display_name"] == "My Agent"


def test_custom_sender_broadcast_users_update(tmp_path):
    """Registering a new sender broadcasts a ``users`` update to connected clients."""
    model, client, handler = _setup(tmp_path)
    msg = ClientSendMessage(
        id="m1",
        body="hello",
        sender={"username": "agent", "name": "Agent", "bot": True},
    )

    handler._handle_new_message(msg, model)

    user_frames = _frames_of(client, "users")
    assert len(user_frames) == 1
    assert "agent" in user_frames[0]["users"]
    assert user_frames[0]["users"]["agent"]["bot"] is True


def test_custom_sender_message_stored_with_correct_sender(tmp_path):
    """The stored message uses the custom sender's username, not the authenticated user."""
    model, client, handler = _setup(tmp_path)
    msg = ClientSendMessage(
        id="m1",
        body="hello from agent",
        sender={"username": "agent", "name": "Agent", "bot": True},
    )

    handler._handle_new_message(msg, model)

    stored = model.get_message("m1")
    assert stored is not None
    assert stored.sender == "agent"


def test_known_sender_not_re_registered(tmp_path):
    """A sender already in the users map is not broadcast again on subsequent messages."""
    model, client, handler = _setup(tmp_path)
    model.set_user(User(username="agent", name="Agent", bot=True))
    client.messages.clear()  # discard the set_user broadcast

    msg = ClientSendMessage(
        id="m2",
        body="second message",
        sender={"username": "agent", "name": "Agent", "bot": True},
    )

    handler._handle_new_message(msg, model)

    # No new ``users`` broadcast — sender was already registered.
    assert _frames_of(client, "users") == []


# mime_model update
def test_update_message_sets_mime_model(tmp_path):
    """Editing a message with mime_model stores and broadcasts the updated field."""
    model, client, handler = _setup(tmp_path)
    # Send an initial message to have something to edit.
    send_msg = ClientSendMessage(id="m1", body="initial")
    handler._handle_new_message(send_msg, model)
    client.messages.clear()

    mime = {"data": {"text/plain": "streamed output", "text/html": "<b>streamed</b>"}}
    edit_msg = ClientEditMessage(id="m1", body="updated", mime_model=mime)

    handler._handle_update_message(edit_msg, model)

    stored = model.get_message("m1")
    assert stored is not None
    assert stored.mime_model == mime

    message_frames = _frames_of(client, "message")
    assert len(message_frames) == 1
    assert message_frames[0]["message"]["mime_model"] == mime


def test_update_message_without_mime_model_leaves_existing(tmp_path):
    """An edit that omits mime_model does not overwrite an existing one."""
    model, client, handler = _setup(tmp_path)
    send_msg = ClientSendMessage(
        id="m1",
        body="initial",
        mime_model={"data": {"text/plain": "original"}},
    )
    handler._handle_new_message(send_msg, model)

    edit_msg = ClientEditMessage(id="m1", body="new body")
    handler._handle_update_message(edit_msg, model)

    stored = model.get_message("m1")
    assert stored.mime_model == {"data": {"text/plain": "original"}}
