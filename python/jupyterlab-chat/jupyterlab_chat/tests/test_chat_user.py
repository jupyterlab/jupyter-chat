# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for sending messages under a chosen identity.

``add_message`` accepts an optional ``user``: when provided, the user is
registered in the chat and the message is attributed to it. The behaviour must
be identical on both transports (``YChat`` and ``WsChatModel``). The ``add_user``
/ ``ChatUser`` convenience layer builds on the same primitive.
"""

import json

import pytest

from ..models import ChatUser, NewMessage, User
from ..websocket_model import WsChatModel
from ..ychat import YChat


BOT = User(username="bot-1", name="Bot One", display_name="Bot One", bot=True)
BOT2 = User(username="bot-2", name="Bot Two", display_name="Bot Two", bot=True)


class _FakeHandler:
    """Captures messages written to a connected WS client."""

    def __init__(self):
        self.messages = []

    def write_message(self, message):
        self.messages.append(message)


@pytest.fixture(params=["ychat", "ws"])
def model(request, tmp_path):
    """A ``BaseChatModel`` of each transport, so tests cover both."""
    if request.param == "ychat":
        return YChat()
    return WsChatModel(path="chat.chat", root_dir=tmp_path)


# ---------------------------------------------------------------------------
# add_message(user=...)
# ---------------------------------------------------------------------------

def test_add_message_with_user_registers_and_attributes(model):
    assert BOT.username not in model.get_users()

    msg_id = model.add_message(NewMessage(body="Hello from the server"), user=BOT)

    # The user is registered on first send.
    assert BOT.username in model.get_users()
    message = model.get_message(msg_id)
    assert message is not None
    assert message.body == "Hello from the server"
    assert message.sender == BOT.username


def test_add_message_user_overrides_message_sender(model):
    # Even if a sender is set on the NewMessage, the explicit user wins.
    msg_id = model.add_message(
        NewMessage(body="hi", sender="someone-else"), user=BOT
    )

    assert model.get_message(msg_id).sender == BOT.username


def test_add_message_without_user_uses_message_sender(model):
    # The pre-existing behaviour is unchanged when no user is passed.
    msg_id = model.add_message(NewMessage(body="hi", sender="agent"))

    assert model.get_message(msg_id).sender == "agent"


def test_add_message_requires_sender_or_user(model):
    with pytest.raises(ValueError):
        model.add_message(NewMessage(body="orphan message"))


def test_add_message_does_not_reregister_existing_user(model):
    model.set_user(BOT)
    calls = []
    original_set_user = model.set_user

    def tracking_set_user(user):
        calls.append(user)
        original_set_user(user)

    model.set_user = tracking_set_user  # type: ignore[method-assign]

    model.add_message(NewMessage(body="second"), user=BOT)

    # BOT was already present, so add_message should not re-register it.
    assert calls == []


def test_multiple_bots_share_one_chat(model):
    id_a = model.add_message(NewMessage(body="from bot 1"), user=BOT)
    id_b = model.add_message(NewMessage(body="from bot 2"), user=BOT2)

    assert model.get_message(id_a).sender == BOT.username
    assert model.get_message(id_b).sender == BOT2.username
    assert {BOT.username, BOT2.username} <= set(model.get_users())


# ---------------------------------------------------------------------------
# add_user() -> ChatUser convenience layer
# ---------------------------------------------------------------------------

def test_add_user_registers_and_returns_chat_user(model):
    chat_user = model.add_user(BOT)

    assert isinstance(chat_user, ChatUser)
    assert chat_user.user is BOT
    assert chat_user.model is model
    assert BOT.username in model.get_users()


def test_chat_user_send_message_forwards(model):
    chat_user = model.add_user(BOT)

    msg_id = chat_user.send_message("Sent via ChatUser")

    message = model.get_message(msg_id)
    assert message is not None
    assert message.sender == BOT.username
    assert message.body == "Sent via ChatUser"


def test_chat_user_broadcast_writing_status_forwards_ws(tmp_path):
    """On the WS transport the status reaches connected clients as this user."""
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    handler = _FakeHandler()
    model.handlers["client-1"] = handler  # type: ignore[assignment]

    chat_user = model.add_user(BOT)
    chat_user.broadcast_writing_status({"typingIndicator": "thinking..."})

    frame = json.loads(handler.messages[-1])
    assert frame["type"] == "writing"
    assert frame["state"] is True
    assert frame["typingIndicator"] == "thinking..."
    assert frame["user"]["username"] == BOT.username


def test_chat_user_broadcast_writing_status_stop_ws(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    handler = _FakeHandler()
    model.handlers["client-1"] = handler  # type: ignore[assignment]

    chat_user = model.add_user(BOT)
    chat_user.broadcast_writing_status(None)

    frame = json.loads(handler.messages[-1])
    assert frame["state"] is False
    assert frame["user"]["username"] == BOT.username


def test_base_broadcast_writing_status_is_noop_on_ychat():
    """YChat does not implement live presence, so this must not raise."""
    chat = YChat()
    chat_user = chat.add_user(BOT)
    # Should be a no-op, not an error.
    chat_user.broadcast_writing_status({"typingIndicator": "x"})
