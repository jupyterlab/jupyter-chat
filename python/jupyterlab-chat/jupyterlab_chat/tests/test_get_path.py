# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for ``BaseChatModel.get_path()`` on both transports."""

import os
from pathlib import Path

import pytest

from jupyterlab_chat.websocket_model import WsChatModel
from jupyterlab_chat.ychat import YChat


@pytest.fixture
def jp_server_config():
    # Enable the File ID service, so the server registers a ``file_id_manager``
    # in its web app settings. This mirrors an RTC deployment, where
    # jupyter-collaboration pulls in ``jupyter_server_fileid``.
    return {"ServerApp": {"jpserver_extensions": {"jupyter_server_fileid": True}}}


def test_ws_chat_model_get_path(tmp_path):
    model = WsChatModel(path="sub/chat.chat", root_dir=tmp_path)
    assert model.get_path() == "sub/chat.chat"


def test_ychat_get_path(jp_serverapp):
    """With a running server whose File ID service is enabled, ``get_path()``
    resolves the file id from the room id and returns the file's current path,
    following it across an in-band move."""
    fim = jp_serverapp.web_app.settings["file_id_manager"]

    root = Path(jp_serverapp.root_dir)
    (root / "sub").mkdir(parents=True, exist_ok=True)
    (root / "sub" / "chat.chat").write_text("{}")
    file_id = fim.index("sub/chat.chat")

    chat = YChat()
    chat.room_id = f"text:chat:{file_id}"
    assert chat.get_path() == "sub/chat.chat"

    # After an in-band move, get_path() follows the file via its stable id.
    (root / "moved").mkdir()
    os.rename(root / "sub" / "chat.chat", root / "moved" / "chat.chat")
    fim.move("sub/chat.chat", "moved/chat.chat")
    assert chat.get_path() == "moved/chat.chat"


def test_ychat_get_path_falls_back_to_initial_path():
    # With no resolvable room id / File ID service, get_path() returns the
    # initial_path recorded when the room was created.
    chat = YChat()
    chat.initial_path = "sub/chat.chat"
    assert chat.get_path() == "sub/chat.chat"
