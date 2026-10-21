# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for dynamic user/metadata propagation on the RTC-free WebSocket model.

Reproduces the reported bug: an AI persona registers itself on the live model
(``model.set_user``) *after* web clients have already connected, so without a
broadcast the connected clients never learn the persona's name/avatar. The same
gap exists for ``set_metadata``.

A connected client is, on the server, exactly an entry in ``model.handlers``
whose ``write_message`` writes to that client's socket; a recording fake handler
is therefore a faithful stand-in (same pattern as ``test_writing.py``).
"""
import json

from jupyterlab_chat.models import User
from jupyterlab_chat.websocket_model import WsChatModel


class _FakeHandler:
    """Captures frames written to a connected client."""

    def __init__(self):
        self.messages = []

    def write_message(self, message):
        self.messages.append(message)


def _model_with_client(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    handler = _FakeHandler()
    model.handlers["client-1"] = handler  # type: ignore[assignment]
    return model, handler


def _frames_of(handler, action):
    return [
        json.loads(m)
        for m in handler.messages
        if json.loads(m).get("type") == "server" and json.loads(m).get("action") == action
    ]


def test_set_user_broadcasts_to_connected_clients(tmp_path):
    """Adding a user after a client connects pushes a ``users`` update to it."""
    model, handler = _model_with_client(tmp_path)
    persona = User(
        username="jovian-bot",
        name="Jovian",
        display_name="Jovian",
        avatar_url="/avatar/jovian.png",
        bot=True,
    )

    model.set_user(persona)

    frames = _frames_of(handler, "users")
    assert len(frames) == 1
    users = frames[0]["users"]
    assert "jovian-bot" in users
    assert users["jovian-bot"]["display_name"] == "Jovian"
    assert users["jovian-bot"]["avatar_url"] == "/avatar/jovian.png"
    assert users["jovian-bot"]["bot"] is True


def test_set_metadata_broadcasts_to_connected_clients(tmp_path):
    """Setting chat metadata after a client connects pushes a ``metadata`` update."""
    model, handler = _model_with_client(tmp_path)

    model.set_metadata("banner", {"text": "hello"})

    frames = _frames_of(handler, "metadata")
    assert len(frames) == 1
    assert frames[0]["metadata"]["banner"] == {"text": "hello"}


def test_set_user_does_not_persist_or_require_clients(tmp_path):
    """set_user works with no connected clients and does not write the file."""
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    model.set_user(User(username="solo"))
    assert "solo" in model._users
    assert not (tmp_path / "chat.chat").exists()
