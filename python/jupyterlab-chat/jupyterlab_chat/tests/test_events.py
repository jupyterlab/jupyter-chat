# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Unit tests for jupyterlab_chat.events.ChatManager (WebSocket path)."""
import asyncio
import time
from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

from jupyter_events import EventLogger

from jupyterlab_chat.events import ChatManager
from jupyterlab_chat.models import NewMessage
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


def test_last_client_gone_frees_model(tmp_path):
    """When the last client disconnects and no server-side writer is active, the
    model is freed, so the next open builds a fresh model instead of reusing a
    stale in-memory instance that would accumulate messages across reopens."""

    async def run():
        capture: list = []
        mgr = _make_manager(tmp_path, capture)
        chat = tmp_path / "r.chat"
        chat.write_text("{}")

        m1 = mgr.ws_open("r.chat")
        m1.handlers["client-1"] = SimpleNamespace(write_message=lambda *a, **k: None)
        m1.add_message(NewMessage(body="first message", sender="u"))

        # Last client disconnects with no active writer -> model is freed.
        m1.handlers.clear()
        capture.clear()
        mgr.ws_client_gone("r.chat")
        await _drain()
        assert mgr.get("r.chat") is None
        assert {"path": "r.chat", "action": "closed"} in capture

        # Reopening builds a fresh model, not the stale in-memory instance.
        m2 = mgr.ws_open("r.chat")
        assert m2 is not m1
        mgr.stop()

    asyncio.run(run())


def test_reopen_while_live_reuses_in_memory_model(tmp_path):
    """A reopen while the chat is still live (a client is connected) reuses the
    same in-memory model without reloading, so attached server-side state is
    preserved on reconnect."""

    async def run():
        mgr = _make_manager(tmp_path, [])
        (tmp_path / "r.chat").write_text("{}")

        m1 = mgr.ws_open("r.chat")
        m1.handlers["client-1"] = SimpleNamespace(write_message=lambda *a, **k: None)
        m1.add_message(NewMessage(body="first message", sender="u"))

        # A second client connects while the first is still present.
        m2 = mgr.ws_open("r.chat")
        assert m2 is m1  # same live model
        assert len(m2._messages) == 1  # nothing reloaded or reset
        mgr.stop()

    asyncio.run(run())


def test_client_connected_and_disconnected_events(tmp_path):
    async def run():
        events: list = []

        logger = EventLogger()
        settings = {"event_logger": logger, "server_root_dir": str(tmp_path)}
        serverapp = cast(
            "ServerApp",
            SimpleNamespace(web_app=SimpleNamespace(settings=settings)),
        )
        mgr = ChatManager(serverapp, rtc_enabled=False, start_poller=False)

        async def on_event(logger, schema_id, data):
            if data["action"] in ("client_connected", "client_disconnected"):
                events.append(data)

        mgr.observe_chats(on_event)

        mgr.client_connected("a.chat", "client-1")
        mgr.client_connected("a.chat", "client-2")
        mgr.client_disconnected("a.chat", "client-1")
        await _drain()

        assert events == [
            {"path": "a.chat", "action": "client_connected", "client_id": "client-1"},
            {"path": "a.chat", "action": "client_connected", "client_id": "client-2"},
            {"path": "a.chat", "action": "client_disconnected", "client_id": "client-1"},
        ]

    asyncio.run(run())
