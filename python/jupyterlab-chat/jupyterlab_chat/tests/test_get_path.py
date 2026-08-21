# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for ``BaseChatModel.get_path()`` on both transports."""

from unittest.mock import Mock

from jupyterlab_chat.websocket_model import WsChatModel
from jupyterlab_chat.ychat import YChat


def test_ws_chat_model_get_path(tmp_path):
    model = WsChatModel(path="sub/chat.chat", root_dir=tmp_path)
    assert model.get_path() == "sub/chat.chat"


def test_ychat_get_path_falls_back_to_shared_state():
    # No running server (and no File ID service): get_path() returns the
    # root-relative path recorded in the shared document state.
    chat = YChat()
    chat.path = "sub/chat.chat"
    assert chat.get_path() == "sub/chat.chat"


def test_ychat_get_path_prefers_file_id_service(monkeypatch):
    # When a File ID service is available, the live path is resolved from the
    # stable file id, so the path follows the file across moves/renames.
    chat = YChat()
    chat.path = "old/chat.chat"

    fake_fim = Mock()
    fake_fim.get_id.return_value = "file-1"
    fake_fim.get_path.return_value = "new/chat.chat"
    monkeypatch.setattr(YChat, "_get_file_id_manager", staticmethod(lambda: fake_fim))

    assert chat.get_path() == "new/chat.chat"
    fake_fim.get_id.assert_called_once_with("old/chat.chat")
    fake_fim.get_path.assert_called_once_with("file-1")
