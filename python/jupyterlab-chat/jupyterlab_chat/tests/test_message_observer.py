# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Unit tests for the transport-agnostic message observer API.

Covers ``observe_messages``/``unobserve_messages`` on both the WebSocket model
(RTC-free) and the collaborative ``YChat``.
"""
from pathlib import Path
from typing import List

import pytest
from pycrdt import Map

from jupyterlab_chat.models import (
    ChatMessageAction,
    ChatMessageEvent,
    NewMessage,
    User,
)
from jupyterlab_chat.websocket_model import WsChatModel
from jupyterlab_chat.ychat import YChat


def _ws_model(tmp_path: Path) -> WsChatModel:
    (tmp_path / "chat.chat").write_text("{}")
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    model.load_from_file()
    return model


# --------------------------------------------------------------------------
# WebSocket model (RTC-free)
# --------------------------------------------------------------------------
def test_ws_server_msg_sent_and_unobserve(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    events: List[ChatMessageEvent] = []
    token = model.observe_messages(events.append)

    model.add_message(NewMessage(body="hi", sender="agent"))
    assert len(events) == 1
    assert events[0].action == ChatMessageAction.SERVER_MSG_SENT
    assert events[0].message.body == "hi"

    # After unobserve, no further events are delivered.
    model.unobserve_messages(token)
    model.add_message(NewMessage(body="again", sender="agent"))
    assert len(events) == 1


def test_ws_server_msg_updated(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    msg_id = model.add_message(NewMessage(body="v1", sender="agent"))

    events: List[ChatMessageEvent] = []
    model.observe_messages(events.append)

    updated = model.get_message(msg_id)
    assert updated is not None
    updated.body = "v2"
    model.update_message(updated)

    assert [e.action for e in events] == [ChatMessageAction.SERVER_MSG_UPDATED]
    assert events[0].message.body == "v2"


def test_ws_client_events(tmp_path: Path) -> None:
    # CLIENT_* events are emitted by the WS handler; exercise the model's
    # emission path directly here.
    model = _ws_model(tmp_path)
    msg_id = model.add_message(NewMessage(body="hi", sender="jovyan"))
    message = model.get_message(msg_id)
    assert message is not None

    events: List[ChatMessageEvent] = []
    model.observe_messages(events.append)
    model._emit_message_event(ChatMessageAction.CLIENT_MSG_RECEIVED, message)
    model._emit_message_event(ChatMessageAction.CLIENT_MSG_EDITED, message)

    assert [e.action for e in events] == [
        ChatMessageAction.CLIENT_MSG_RECEIVED,
        ChatMessageAction.CLIENT_MSG_EDITED,
    ]


def test_ws_multiple_observers(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    a: List[ChatMessageEvent] = []
    b: List[ChatMessageEvent] = []
    token_a = model.observe_messages(a.append)
    model.observe_messages(b.append)

    model.add_message(NewMessage(body="1", sender="agent"))
    assert len(a) == 1 and len(b) == 1

    model.unobserve_messages(token_a)
    model.add_message(NewMessage(body="2", sender="agent"))
    assert len(a) == 1 and len(b) == 2


def test_ws_observer_error_is_isolated(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    good: List[ChatMessageEvent] = []

    def boom(event: ChatMessageEvent) -> None:
        raise RuntimeError("observer blew up")

    model.observe_messages(boom)
    model.observe_messages(good.append)
    # A failing observer must not prevent others from being notified.
    model.add_message(NewMessage(body="hi", sender="agent"))
    assert len(good) == 1


# --------------------------------------------------------------------------
# Collaborative model (YChat)
# --------------------------------------------------------------------------
def _insert_ymessage(chat: YChat, message: dict) -> None:
    # raw_time=False avoids the server-timestamp reschedule (which uses an
    # asyncio task) so the test stays synchronous.
    message.setdefault("raw_time", False)
    with chat._ydoc.transaction():
        chat._ymessages.append(Map(message))


def test_ychat_insert_classification_and_unobserve() -> None:
    chat = YChat()
    # Give the document an id first so flipping `dirty` does not schedule
    # `create_id()` (which needs a running event loop).
    chat.set_id("test-chat")
    chat.dirty = False  # simulate a fully-loaded document
    chat.set_user(User(username="human", name="H", display_name="H"))
    chat.set_user(User(username="bot", name="B", display_name="B", bot=True))

    events: List[ChatMessageEvent] = []
    token = chat.observe_messages(events.append)

    _insert_ymessage(
        chat, {"id": "m1", "body": "from human", "time": 1.0, "sender": "human"}
    )
    _insert_ymessage(
        chat, {"id": "m2", "body": "from bot", "time": 2.0, "sender": "bot"}
    )

    by_body = {e.message.body: e.action for e in events}
    assert by_body["from human"] == ChatMessageAction.CLIENT_MSG_RECEIVED
    assert by_body["from bot"] == ChatMessageAction.SERVER_MSG_SENT

    chat.unobserve_messages(token)
    _insert_ymessage(
        chat, {"id": "m3", "body": "after", "time": 3.0, "sender": "human"}
    )
    assert "after" not in [e.message.body for e in events]
