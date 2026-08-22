# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Unit tests for jupyterlab_chat.chat_manager.ChatManager (WebSocket path)."""
import asyncio
import time
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

import jupyter_server
from jupyter_events import EventLogger

from jupyterlab_chat.chat_manager import ChatManager
from jupyterlab_chat.models import NewMessage
from jupyterlab_chat.websocket_model import WsChatModel

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp


def _event_logger() -> EventLogger:
    """An EventLogger with the ContentsManager schema registered, matching a
    real server (so freeing a WsChatModel can remove its contents listener)."""
    logger = EventLogger()
    logger.register_event_schema(
        Path(jupyter_server.__file__).parent
        / "event_schemas"
        / "contents_service"
        / "v1.yaml"
    )
    return logger


def _make_manager(tmp_path, capture):
    logger = _event_logger()
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


def _find(capture, path, action):
    """Return the captured event matching path+action, or None."""
    for e in capture:
        if e.get("path") == path and e.get("action") == action:
            return e
    return None


def test_ws_open_emits_opened_once_and_get(tmp_path):
    async def run():
        capture: list = []
        mgr = _make_manager(tmp_path, capture)
        (tmp_path / "a.chat").write_text("{}")

        model = mgr.ws_open("a.chat")
        assert isinstance(model, WsChatModel)
        await _drain()
        opened = _find(capture, "a.chat", "opened")
        assert opened is not None
        assert opened["chat_id"] == model.get_id()

        # model access
        assert mgr.get("a.chat") is model
        assert mgr.get("missing.chat") is None
        assert mgr.get("text:chat:xyz") is None  # unknown key (path) is not live

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
        closed = _find(capture, "c.chat", "closed")
        assert closed is not None
        assert closed["chat_id"] == model.get_id()
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
        model = mgr.ws_open("e.chat")

        chat.unlink()  # deleted via filesystem/ContentsManager
        capture.clear()
        mgr._poll()
        await _drain()

        assert mgr.get("e.chat") is None
        deleted = _find(capture, "e.chat", "deleted")
        assert deleted is not None
        assert deleted["chat_id"] == model.get_id()
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
        closed = _find(capture, "r.chat", "closed")
        assert closed is not None
        assert closed["chat_id"] == m1.get_id()

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

        logger = _event_logger()
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

        # A live model must exist for client events to carry its chat_id (in
        # production the WS handler calls ws_open before on_client_connect).
        (tmp_path / "a.chat").write_text("{}")
        model = mgr.ws_open("a.chat")
        chat_id = model.get_id()

        mgr.on_client_connect("a.chat", "client-1")
        mgr.on_client_connect("a.chat", "client-2")
        mgr.on_client_disconnect("a.chat", "client-1")
        await _drain()

        assert events == [
            {"path": "a.chat", "action": "client_connected", "chat_id": chat_id, "client_id": "client-1"},
            {"path": "a.chat", "action": "client_connected", "chat_id": chat_id, "client_id": "client-2"},
            {"path": "a.chat", "action": "client_disconnected", "chat_id": chat_id, "client_id": "client-1"},
        ]

    asyncio.run(run())
