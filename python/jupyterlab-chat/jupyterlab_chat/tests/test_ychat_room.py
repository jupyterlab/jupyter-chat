# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests of a ``YChat`` loaded by a real jupyter-collaboration ``DocumentRoom``.

The room is built with the fakes shipped by ``jupyter_server_ydoc`` (no server is
started). Since jupyter-collaboration 5, the room does not reset the ``dirty``
state after loading the file: it only does so after a save. These tests make
sure the chat is usable right after the room initialization, before any save.
"""
from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio

pytest.importorskip("jupyter_server_ydoc")

from jupyter_server_ydoc.loaders import FileLoader  # noqa: E402
from jupyter_server_ydoc.rooms import DocumentRoom  # noqa: E402
from jupyter_server_ydoc.test_utils import (  # noqa: E402
    FakeContentsManager,
    FakeEventLogger,
    FakeFileIDManager,
)
from pycrdt import Doc, Map  # noqa: E402

from ..models import ChatMessageEvent, NewMessage  # noqa: E402
from ..ychat import YChat  # noqa: E402

FILE_ID = "file-id"
CLIENT_TIME = 1.0

CONTENT = {
    "messages": [
        {
            "id": "existing",
            "body": "loaded from disk",
            "time": 10.0,
            "sender": "human",
            "raw_time": False,
        }
    ],
    "users": {"human": {"username": "human", "name": "Human"}},
    "attachments": {},
    "metadata": {"id": "chat-id"},
}


@asynccontextmanager
async def _create_room(content: dict):
    contents_manager = FakeContentsManager(
        {"content": json.dumps(content), "writable": True}
    )
    loader = FileLoader(
        FILE_ID,
        FakeFileIDManager({FILE_ID: "test.chat"}),
        contents_manager,
        poll_interval=0.1,
    )
    # A long save delay, so that no save happens during the test.
    room = DocumentRoom(
        f"text:chat:{FILE_ID}",
        "text",
        "chat",
        loader,
        FakeEventLogger(),
        None,
        None,
        save_delay=3600,
    )
    await room.initialize()
    try:
        yield room, contents_manager
    finally:
        await room.stop()
        await loader.clean()


@pytest_asyncio.fixture
async def room_and_contents():
    """An initialized room loading ``CONTENT``, and its fake contents manager."""
    async with _create_room(CONTENT) as result:
        yield result


def _client_sends_message(
    room: DocumentRoom, message: dict, index: int | None = None
) -> None:
    """Insert a message from a remote client, synchronized through Y updates."""
    client_doc = Doc()
    client_doc.apply_update(room.ydoc.get_update())
    client_chat = YChat(client_doc)
    state = room.ydoc.get_state()
    with client_doc.transaction():
        if index is None:
            client_chat.ymessages.append(Map(message))
        else:
            client_chat.ymessages.insert(index, Map(message))
    room.ydoc.apply_update(client_doc.get_update(state))


async def _wait_scheduled_updates() -> None:
    """Let the event loop run the callbacks scheduled by the YChat.

    The YChat observers cannot write to the document (they run at the end of a
    transaction), so the updates they trigger (e.g. ``_set_timestamp``) are
    scheduled with ``loop.call_soon()``. ``asyncio.sleep(0)`` suspends the test
    for one loop iteration, during which the loop runs the callbacks already
    scheduled (FIFO). One iteration is enough today; a few more give some margin
    in case a callback schedules another one.

    It is also needed to check that *no* update happens: without it, the test
    would pass even if an update had been scheduled.

    This only waits for ``call_soon()`` callbacks, not for tasks awaiting I/O or
    a real delay.
    """
    for _ in range(3):
        await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_room_loads_existing_messages_untouched(room_and_contents):
    room, contents_manager = room_and_contents
    chat = room._document
    assert isinstance(chat, YChat)
    await asyncio.sleep(0)

    assert [m.body for m in chat.get_messages()] == ["loaded from disk"]
    assert chat.get_messages()[0].time == 10.0
    assert chat.get_id() == "chat-id"
    assert not any(a.startswith("save") for a in contents_manager.actions)


@pytest.mark.asyncio
async def test_client_message_before_first_save(room_and_contents):
    room, contents_manager = room_and_contents
    chat: YChat = room._document
    events: list[ChatMessageEvent] = []
    chat.observe_messages(events.append)

    _client_sends_message(
        room,
        {
            "id": "from-client",
            "body": "hello",
            "time": CLIENT_TIME,
            "sender": "human",
            "raw_time": True,
        },
    )
    await asyncio.sleep(0)

    # No save happened, the document may still be flagged as dirty.
    assert not any(a.startswith("save") for a in contents_manager.actions)

    # The observers are notified of the new message...
    assert [e.message.body for e in events] == ["hello"]
    # ...and its timestamp is set from the server.
    message = chat.get_message("from-client")
    assert message is not None
    assert message.raw_time is False
    assert message.time != CLIENT_TIME
    assert [m.id for m in chat.get_messages()] == ["existing", "from-client"]


@pytest.mark.asyncio
async def test_backend_message_before_first_save(room_and_contents):
    room, contents_manager = room_and_contents
    chat: YChat = room._document
    events: list[ChatMessageEvent] = []
    chat.observe_messages(events.append)

    msg_id = chat.add_message(NewMessage(body="from backend", sender="human"))
    await asyncio.sleep(0)

    assert not any(a.startswith("save") for a in contents_manager.actions)
    assert [e.message.body for e in events] == ["from backend"]
    assert [m.id for m in chat.get_messages()] == ["existing", msg_id]


@pytest.mark.asyncio
async def test_room_loads_messages_without_raw_time_untouched():
    """Messages stored without `raw_time` (e.g. older files, or files written by
    hand) must keep their timestamp and order when the room loads them."""
    content = {
        "messages": [
            {"id": f"m{i}", "body": f"message {i}", "time": 10.0 + i, "sender": "human"}
            for i in range(3)
        ],
        "users": {"human": {"username": "human", "name": "Human"}},
    }
    async with _create_room(content) as (room, _):
        chat: YChat = room._document
        await _wait_scheduled_updates()

        messages = chat.get_messages()
        assert [m.id for m in messages] == ["m0", "m1", "m2"]
        assert [m.time for m in messages] == [10.0, 11.0, 12.0]
        assert all(isinstance(m, Map) for m in chat.ymessages)


@pytest.mark.asyncio
async def test_moved_client_message_stays_a_map(room_and_contents):
    """A client message whose server timestamp moves it in the list must be
    reinserted as a Map, as clients expect a list of Y.Map."""
    room, _ = room_and_contents
    chat: YChat = room._document

    # Inserted before the existing message, it must be moved after it once its
    # timestamp is set from the server.
    _client_sends_message(
        room,
        {
            "id": "from-client",
            "body": "hello",
            "time": CLIENT_TIME,
            "sender": "human",
            "raw_time": True,
        },
        index=0,
    )
    await _wait_scheduled_updates()

    assert [m.id for m in chat.get_messages()] == ["existing", "from-client"]
    assert all(isinstance(m, Map) for m in chat.ymessages)
    message = chat.get_message("from-client")
    assert message is not None
    assert message.raw_time is False
    assert message.time != CLIENT_TIME
