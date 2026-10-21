# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for WsChatModel stable id and in-band move tracking."""

import json

import pytest

from jupyterlab_chat.websocket_model import WsChatModel


def test_get_id_is_a_stable_str(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    chat_id = model.get_id()
    assert isinstance(chat_id, str) and chat_id
    # Stable across calls (for the lifetime of the model instance).
    assert model.get_id() == chat_id


@pytest.mark.asyncio
async def test_rename_event_updates_path(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    await model._on_contents_event(
        None,
        "contents_service/v1",
        {"action": "rename", "source_path": "chat.chat", "path": "moved.chat"},
    )
    assert model.get_path() == "moved.chat"


@pytest.mark.asyncio
async def test_directory_rename_updates_nested_path(tmp_path):
    model = WsChatModel(path="dir/chat.chat", root_dir=tmp_path)
    await model._on_contents_event(
        None,
        "contents_service/v1",
        {"action": "rename", "source_path": "dir", "path": "renamed"},
    )
    assert model.get_path() == "renamed/chat.chat"


@pytest.mark.asyncio
async def test_unrelated_rename_leaves_path(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    await model._on_contents_event(
        None,
        "contents_service/v1",
        {"action": "rename", "source_path": "other.txt", "path": "renamed.txt"},
    )
    assert model.get_path() == "chat.chat"


@pytest.mark.asyncio
async def test_non_rename_action_ignored(tmp_path):
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    await model._on_contents_event(
        None, "contents_service/v1", {"action": "save", "path": "chat.chat"}
    )
    assert model.get_path() == "chat.chat"


def test_moved_model_saves_to_new_path(tmp_path):
    """After a move, save() writes at the new path (and not the old one)."""
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    model.path = "moved.chat"  # simulate the post-move tracked path
    model.save()

    assert (tmp_path / "moved.chat").exists()
    assert not (tmp_path / "chat.chat").exists()
    saved = json.loads((tmp_path / "moved.chat").read_text())
    assert saved["messages"] == []
