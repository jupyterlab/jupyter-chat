# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for the WebSocket writing-status relay (RTC-free typing indicator)."""

import json

from jupyterlab_chat.models import User
from jupyterlab_chat.websocket_model import WsChatModel


class _FakeHandler:
    """Captures messages written to a connected client."""

    def __init__(self):
        self.messages = []

    def write_message(self, message):
        self.messages.append(message)


def _model_with_client(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    handler = _FakeHandler()
    # _FakeHandler duck-types the WebSocketHandler surface used here (write_message).
    model.handlers["client-1"] = handler  # type: ignore[assignment]
    return model, handler


def test_broadcast_writing_status_frame(tmp_path):
    model, handler = _model_with_client(tmp_path)
    user = User(username="bot", name="Bot", display_name="Bot-Agent")

    model.broadcast_writing_status(user, {"typingIndicator": "is running ripgrep"})

    assert len(handler.messages) == 1
    frame = json.loads(handler.messages[0])
    assert frame["type"] == "server"
    assert frame["action"] == "writing"
    assert frame["state"] is True
    assert frame["typingIndicator"] == "is running ripgrep"
    assert frame["user"]["username"] == "bot"
    assert frame["user"]["display_name"] == "Bot-Agent"


def test_broadcast_writing_status_preserves_bot_flag(tmp_path):
    """`bot` must survive serialization: consumers (e.g. a stop button) use
    `user.bot` to distinguish AI writers from humans. Regression for the
    persona stop button never enabling because the writer's `bot` was dropped.
    """
    model, handler = _model_with_client(tmp_path)
    bot_user = User(username="jovyan-bot", name="Agent", bot=True)
    human = User(username="jovyan", name="Jovyan")

    model.broadcast_writing_status(bot_user, {"typingIndicator": "Writing..."})
    model.broadcast_writing_status(human, {"typingIndicator": "typing"})

    bot_frame = json.loads(handler.messages[0])
    human_frame = json.loads(handler.messages[1])
    assert bot_frame["user"]["bot"] is True
    assert human_frame["user"]["bot"] is False


def test_broadcast_writing_status_stop(tmp_path):
    model, handler = _model_with_client(tmp_path)

    model.broadcast_writing_status(User(username="bot"), None)

    frame = json.loads(handler.messages[0])
    assert frame["type"] == "server"
    assert frame["action"] == "writing"
    assert frame["state"] is False
    assert frame["user"]["username"] == "bot"
    assert "typingIndicator" not in frame


def test_writing_is_not_persisted(tmp_path):
    model, _ = _model_with_client(tmp_path)

    model.broadcast_writing_status(User(username="bot"), {"typingIndicator": "x"})

    # Ephemeral: broadcasting a writing status must not create/modify the file.
    assert not (tmp_path / "chat.chat").exists()
