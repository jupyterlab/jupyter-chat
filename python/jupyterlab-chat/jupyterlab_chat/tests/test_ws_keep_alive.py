# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for ``WsChatModel.keep_alive`` and ChatManager memory reclamation.

``keep_alive()`` lets a server-side producer (e.g. an AI persona) pin a chat in
memory while it finishes work, so the model is not freed the moment the last
client disconnects. These cover the model-level context manager, the
``ChatManager`` honoring it, and -- via ``weakref`` -- that a *freed* model is
actually released from memory. The last point matters because ``WsChatModel``
registers a ContentsManager event listener whose bound-method callback would
otherwise keep the instance alive; ``dispose()`` must remove it.
"""
import asyncio
import gc
import time
import weakref
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

import jupyter_server
import pytest
from jupyter_events import EventLogger

from jupyterlab_chat.chat_manager import ChatManager
from jupyterlab_chat.websocket_model import WsChatModel

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp


def _event_logger() -> EventLogger:
    """An EventLogger with the ContentsManager schema registered, matching a real
    server (so a WsChatModel can register/remove its contents listener)."""
    logger = EventLogger()
    logger.register_event_schema(
        Path(jupyter_server.__file__).parent
        / "event_schemas"
        / "contents_service"
        / "v1.yaml"
    )
    return logger


def _make_manager(tmp_path) -> ChatManager:
    logger = _event_logger()
    settings = {"event_logger": logger, "server_root_dir": str(tmp_path)}
    serverapp = cast(
        "ServerApp", SimpleNamespace(web_app=SimpleNamespace(settings=settings))
    )
    # The scanner is driven manually via `_scan_freeable_chats()` for
    # deterministic timing.
    return ChatManager(serverapp, rtc_enabled=False, start_scanner=False)


# ---------------------------------------------------------------------------
# Model-level context manager
# ---------------------------------------------------------------------------


def test_keep_alive_toggles_is_kept_alive(tmp_path):
    model = WsChatModel(path="a.chat", root_dir=tmp_path)
    assert model.is_kept_alive is False
    with model.keep_alive():
        assert model.is_kept_alive is True
    assert model.is_kept_alive is False


def test_keep_alive_is_reentrant(tmp_path):
    model = WsChatModel(path="a.chat", root_dir=tmp_path)
    with model.keep_alive():
        with model.keep_alive():
            assert model.is_kept_alive is True
        # Still alive: the outer context is still open.
        assert model.is_kept_alive is True
    assert model.is_kept_alive is False


def test_keep_alive_releases_on_exception(tmp_path):
    model = WsChatModel(path="a.chat", root_dir=tmp_path)
    with pytest.raises(RuntimeError):
        with model.keep_alive():
            raise RuntimeError("boom")
    assert model.is_kept_alive is False


# ---------------------------------------------------------------------------
# ChatManager honors keep_alive
# ---------------------------------------------------------------------------


def test_keep_alive_blocks_free_on_last_client_gone(tmp_path):
    async def run():
        mgr = _make_manager(tmp_path)
        (tmp_path / "c.chat").write_text("{}")
        model = mgr.ws_open("c.chat")
        chat_id = model.get_id()

        with model.keep_alive():
            # Last client disconnects while a keep_alive context is open.
            mgr.ws_client_gone(chat_id)
            assert mgr.get(chat_id) is model  # pinned, not freed

        # Context exited and the last client already left -> the poller reclaims.
        mgr._last_activity_by_id[chat_id] = time.time() - 10_000
        mgr._scan_freeable_chats()
        assert mgr.get(chat_id) is None
        mgr.stop()

    asyncio.run(run())


def test_keep_alive_blocks_scan_reclaim(tmp_path):
    async def run():
        mgr = _make_manager(tmp_path)
        (tmp_path / "d.chat").write_text("{}")
        model = mgr.ws_open("d.chat")
        chat_id = model.get_id()
        assert not model.handlers

        with model.keep_alive():
            mgr._last_activity_by_id[chat_id] = time.time() - 10_000  # stale
            mgr._scan_freeable_chats()
            assert mgr.get(chat_id) is model  # kept alive despite inactivity

        mgr._last_activity_by_id[chat_id] = time.time() - 10_000
        mgr._scan_freeable_chats()
        assert mgr.get(chat_id) is None
        mgr.stop()

    asyncio.run(run())


# ---------------------------------------------------------------------------
# weakref: a freed model is released from memory; a kept-alive one is retained
# ---------------------------------------------------------------------------


def test_freed_model_is_garbage_collected(tmp_path):
    """Stopping a chat (last client gone, no keep_alive) must drop every
    reference so the model is collectable -- in particular ``dispose()`` removes
    the ContentsManager listener, whose bound-method callback would otherwise
    keep the model alive."""

    async def run():
        mgr = _make_manager(tmp_path)
        (tmp_path / "e.chat").write_text("{}")
        model = mgr.ws_open("e.chat")
        chat_id = model.get_id()
        ref = weakref.ref(model)
        assert ref() is not None

        # Stop the chat: last client gone with no keep_alive context -> freed.
        mgr.ws_client_gone(chat_id)
        assert mgr.get(chat_id) is None

        # Drop our own strong reference; nothing else should retain the model.
        del model
        await asyncio.sleep(0)
        gc.collect()
        assert ref() is None
        mgr.stop()

    asyncio.run(run())


def test_kept_alive_model_is_retained_in_memory(tmp_path):
    """The mirror of the above: while a keep_alive context is open, the model
    stays reachable (the manager keeps it) even after the last client leaves."""

    async def run():
        mgr = _make_manager(tmp_path)
        (tmp_path / "f.chat").write_text("{}")
        model = mgr.ws_open("f.chat")
        chat_id = model.get_id()
        ref = weakref.ref(model)

        with model.keep_alive():
            mgr.ws_client_gone(chat_id)
            del model
            await asyncio.sleep(0)
            gc.collect()
            # Retained by the manager because a keep_alive context is open.
            assert ref() is not None
            assert mgr.get(chat_id) is ref()
        mgr.stop()

    asyncio.run(run())
