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
    assert frame["type"] == "writing"
    assert frame["state"] is True
    assert frame["typingIndicator"] == "is running ripgrep"
    assert frame["user"]["username"] == "bot"
    assert frame["user"]["display_name"] == "Bot-Agent"


def test_broadcast_writing_status_accepts_user_dict(tmp_path):
    model, handler = _model_with_client(tmp_path)

    model.broadcast_writing_status(
        {"username": "alice", "display_name": "Alice"}, {"messageID": "m1"}
    )

    frame = json.loads(handler.messages[0])
    assert frame["user"] == {"username": "alice", "display_name": "Alice"}
    assert frame["state"] is True
    assert frame["messageID"] == "m1"


def test_broadcast_writing_status_stop(tmp_path):
    model, handler = _model_with_client(tmp_path)

    model.broadcast_writing_status({"username": "bot"}, None)

    frame = json.loads(handler.messages[0])
    assert frame["state"] is False
    assert frame["user"]["username"] == "bot"
    assert "typingIndicator" not in frame


def test_writing_is_not_persisted(tmp_path):
    model, _ = _model_with_client(tmp_path)

    model.broadcast_writing_status({"username": "bot"}, {"typingIndicator": "x"})

    # Ephemeral: broadcasting a writing status must not create/modify the file.
    assert not (tmp_path / "chat.chat").exists()
