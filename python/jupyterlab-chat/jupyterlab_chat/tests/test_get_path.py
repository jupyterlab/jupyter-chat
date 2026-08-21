# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for ``BaseChatModel.get_path()`` on both transports."""

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
    returns the chat's path relative to the ContentsManager root."""
    assert jp_serverapp.web_app.settings.get("file_id_manager") is not None

    root = Path(jp_serverapp.root_dir)
    (root / "sub").mkdir(parents=True, exist_ok=True)
    (root / "sub" / "chat.chat").write_text("{}")

    chat = YChat()
    chat.path = "sub/chat.chat"
    assert chat.get_path() == "sub/chat.chat"
