# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Unit tests for jupyterlab_chat.events.ChatManager (WebSocket path)."""
import asyncio
import time
from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

from jupyter_events import EventLogger

from jupyterlab_chat.events import ChatManager
from jupyterlab_chat.websocket_model import WsChatModel

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp


def _make_manager(tmp_path, capture):
    logger = EventLogger()
    settings = {"event_logger": logger, "server_root_dir": str(tmp_path)}
    serverapp = cast(
        "ServerApp", SimpleNamespace(web_app=SimpleNamespace(settings=settings))
    )
    mgr = ChatManager(serverapp, rtc_enabled=False, start_poller=False)

    async def listener(logger, schema_id, data):
        capture.append(data)

    mgr.observe_chats(listener)
    return mgr


async def _drain():
    # Let jupyter_events dispatch queued listener coroutines.
    await asyncio.sleep(0.1)


def test_ws_open_emits_opened_once_and_get(tmp_path):
    async def run():
        capture: list = []
        mgr = _make_manager(tmp_path, capture)
        (tmp_path / "a.chat").write_text("{}")

        model = mgr.ws_open("a.chat")
        assert isinstance(model, WsChatModel)
        await _drain()
        assert {"path": "a.chat", "action": "opened"} in capture

        # model access
        assert mgr.get("a.chat") is model
        assert mgr.get("missing.chat") is None
        assert mgr.get("text:chat:xyz") is None  # room id resolves to None w/o RTC

        # second connection to same path: no duplicate `opened`
        capture.clear()
        mgr.ws_open("a.chat")
        await _drain()
        assert capture == []

        mgr.stop()

    asyncio.run(run())


def test_create_get_or_create(tmp_path):
    async def run():
        mgr = _make_manager(tmp_path, [])
        (tmp_path / "b.chat").write_text("{}")
        m = await mgr.create("b.chat")
        assert isinstance(m, WsChatModel)
        assert await mgr.create("b.chat") is m  # get-or-create returns same
        # create on a missing file is allowed (get-or-create)
        m2 = await mgr.create("new.chat")
        assert isinstance(m2, WsChatModel)
        mgr.stop()

    asyncio.run(run())


def test_inactivity_frees_model(tmp_path):
    async def run():
        capture: list = []
        mgr = _make_manager(tmp_path, capture)
        (tmp_path / "c.chat").write_text("{}")
        model = mgr.ws_open("c.chat")
        assert not model.handlers  # no connected clients

        mgr._last_active["c.chat"] = time.time() - 10_000  # stale
        capture.clear()
        mgr._poll()
        await _drain()

        assert mgr.get("c.chat") is None  # garbage-collected
        assert {"path": "c.chat", "action": "closed"} in capture
        mgr.stop()

    asyncio.run(run())


def test_connected_client_keeps_model_alive(tmp_path):
    async def run():
        mgr = _make_manager(tmp_path, [])
        (tmp_path / "d.chat").write_text("{}")
        model = mgr.ws_open("d.chat")
        model.handlers["client-1"] = object()  # simulate a connected client
        mgr._last_active["d.chat"] = time.time() - 10_000

        mgr._poll()
        assert mgr.get("d.chat") is model  # kept because a client is connected
        mgr.stop()

    asyncio.run(run())


def test_deletion_frees_model(tmp_path):
    async def run():
        capture: list = []
        mgr = _make_manager(tmp_path, capture)
        chat = tmp_path / "e.chat"
        chat.write_text("{}")
        mgr.ws_open("e.chat")

        chat.unlink()  # deleted via filesystem/ContentsManager
        capture.clear()
        mgr._poll()
        await _drain()

        assert mgr.get("e.chat") is None
        assert {"path": "e.chat", "action": "deleted"} in capture
        mgr.stop()

    asyncio.run(run())
