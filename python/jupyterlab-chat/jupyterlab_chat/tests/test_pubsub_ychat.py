# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Pub/sub API tests for the RTC transport (``YChat``).

Exercises document topics (backed by the shared Y types) and presence topics
(backed by awareness), verifying that the raw-payload stream folds through
``MergeView`` identically to the RTC-free bus.
"""
from typing import List
from uuid import uuid4

import asyncio

from jupyterlab_chat.models import NewMessage, User
from jupyterlab_chat.pubsub import MergeView, Payload
from jupyterlab_chat.ychat import YChat


def _ychat() -> YChat:
    chat = YChat()
    # Assign an id up front so we don't trigger the lazy create_id() task (which
    # needs a running loop), and clear dirty so message observers fire.
    chat.set_id(uuid4().hex)
    chat.dirty = False
    return chat


# ---------------------------------------------------------------------------
# Document topics
# ---------------------------------------------------------------------------
def test_ychat_sub_messages_snapshot_and_live() -> None:
    async def run() -> None:
        chat = _ychat()
        bot = User(username="agent", name="Agent", display_name="Agent", bot=True)
        chat.set_user(bot)
        chat.add_message(NewMessage(body="history", sender="agent"))

        got: List[Payload] = []
        token = chat.sub(chat.CHAT_MESSAGES_TOPIC, got.append)
        # Snapshot replays the existing message.
        assert [p.data["body"] for p in got] == ["history"]

        # A new message streams as a live event.
        chat.add_message(NewMessage(body="live", sender="agent"))
        assert got[-1].data["body"] == "live"

        chat.unsub(token)
        chat.add_message(NewMessage(body="after", sender="agent"))
        assert [p.data["body"] for p in got] == ["history", "live"]

    asyncio.run(run())


def test_ychat_sub_users_replace_semantics() -> None:
    chat = _ychat()
    got: List[Payload] = []
    chat.sub(chat.CHAT_USERS_TOPIC, got.append)
    # Snapshot (empty), then a whole-map update on each change.
    assert got[-1].data == {}
    chat.pub(chat.CHAT_USERS_TOPIC, {"username": "u1", "name": "U1"})
    assert "u1" in got[-1].data
    assert got[-1].data["u1"]["username"] == "u1"


def test_ychat_pub_message_appends_to_ydoc() -> None:
    async def run() -> None:
        chat = _ychat()
        chat.pub(chat.CHAT_MESSAGES_TOPIC, {"body": "hi", "sender": "jovyan"})
        assert [m.body for m in chat.get_messages()] == ["hi"]

    asyncio.run(run())


def test_ychat_metadata_topic() -> None:
    chat = _ychat()
    got: List[Payload] = []
    chat.sub(chat.CHAT_METADATA_TOPIC, got.append)
    chat.pub(chat.CHAT_METADATA_TOPIC, {"default_persona": "jupyternaut"})
    assert got[-1].data.get("default_persona") == "jupyternaut"


# ---------------------------------------------------------------------------
# Presence topics (awareness)
# ---------------------------------------------------------------------------
def test_ychat_presence_merge_across_publishers() -> None:
    chat = _ychat()
    view = MergeView()
    chat.sub("/writers", view.apply)
    chat.pub("/writers", {"user1": {"typing": True}}, client_id="user1")
    chat.pub("/writers", {"user2": {"typing": True}}, client_id="user2")
    assert set(view.value) == {"user1", "user2"}


def test_ychat_presence_retract_and_remove() -> None:
    chat = _ychat()
    view = MergeView()
    chat.sub("/writers", view.apply)
    chat.pub("/writers", {"user1": {"typing": True}}, client_id="user1")
    chat.pub("/writers", {"user2": {"typing": True}}, client_id="user2")

    # Explicit retract of a whole slot.
    chat.pub("/writers", None, client_id="user1")
    assert set(view.value) == {"user2"}

    # Disconnect cleanup drops the remaining slot.
    chat.remove_client("user2")
    assert view.value in ({}, None) or set(view.value) == set()


def test_ychat_presence_snapshot_on_late_subscribe() -> None:
    chat = _ychat()
    chat.pub("/personas", {"jupyternaut": {"name": "Jupyternaut"}}, client_id="mgr")

    view = MergeView()
    chat.sub("/personas", view.apply)  # late subscriber gets the snapshot
    assert view.value == {"jupyternaut": {"name": "Jupyternaut"}}
