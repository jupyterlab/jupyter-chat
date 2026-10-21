# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests that WsChatModel reads .chat files as UTF-8 whatever the locale."""

import builtins
import json

import pytest

from jupyterlab_chat import websocket_model
from jupyterlab_chat.websocket_model import WsChatModel


@pytest.fixture
def cp1253_locale(monkeypatch):
    """Make open() in websocket_model default to cp1253, as it does on a
    Windows machine with a Greek locale."""

    def _open(file, mode="r", encoding=None):
        return builtins.open(file, mode, encoding=encoding or "cp1253")

    monkeypatch.setattr(websocket_model, "open", _open, raising=False)


def test_load_from_file_reads_utf8_with_non_utf8_locale(tmp_path, cp1253_locale):
    # "ρ" is CF 81 in UTF-8, and 0x81 is undefined in cp1253.
    content = {
        "messages": [{"body": "ρ", "id": "1", "time": 1.0, "sender": "user"}],
    }
    (tmp_path / "chat.chat").write_bytes(
        json.dumps(content, ensure_ascii=False).encode("utf-8")
    )
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    model.load_from_file()
    assert [m.body for m in model.get_messages()] == ["ρ"]
