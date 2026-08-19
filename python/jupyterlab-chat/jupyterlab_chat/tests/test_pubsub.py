# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Unit tests for the generic pub/sub API.

Covers the transport-agnostic :class:`PubSubBus` and :class:`MergeView`, the
``pub``/``sub``/``unsub`` surface on :class:`WsChatModel` (a ``BaseChatModel``),
the special ``/chat/messages`` bridge, and the global channel on ``ChatManager``.
"""
from pathlib import Path
from types import SimpleNamespace
from typing import Any, List, cast

from jupyterlab_chat.events import ChatManager
from jupyterlab_chat.models import NewMessage
from jupyterlab_chat.pubsub import MergeView, Payload, PubSubBus
from jupyterlab_chat.websocket_model import WsChatModel


def _ws_model(tmp_path: Path) -> WsChatModel:
    (tmp_path / "chat.chat").write_text("{}")
    model = WsChatModel(path="chat.chat", root_dir=tmp_path)
    model.load_from_file()
    return model


def _manager(tmp_path: Path) -> ChatManager:
    settings = {"server_root_dir": str(tmp_path)}
    serverapp = cast(Any, SimpleNamespace(web_app=SimpleNamespace(settings=settings)))
    return ChatManager(serverapp, rtc_enabled=False, start_poller=False)


# ---------------------------------------------------------------------------
# PubSubBus
# ---------------------------------------------------------------------------
def test_bus_relays_to_subscribers() -> None:
    bus = PubSubBus()
    got: List[Payload] = []
    bus.sub("/topic", got.append)
    bus.pub("/topic", {"a": 1}, client_id="c1")
    assert got == [Payload(client_id="c1", data={"a": 1})]


def test_bus_snapshot_replays_retained_to_new_subscriber_only() -> None:
    bus = PubSubBus()
    first: List[Payload] = []
    bus.sub("/topic", first.append)
    bus.pub("/topic", {"a": 1}, client_id="c1")
    bus.pub("/topic", {"b": 2}, client_id="c2")

    # A late subscriber is seeded with both retained contributions.
    late: List[Payload] = []
    bus.sub("/topic", late.append)
    assert sorted((p.client_id, tuple(p.data.items())) for p in late) == [
        ("c1", (("a", 1),)),
        ("c2", (("b", 2),)),
    ]
    # The first subscriber saw only the two live publishes, not a replay.
    assert len(first) == 2


def test_bus_none_clears_retained_and_relays() -> None:
    bus = PubSubBus()
    bus.pub("/topic", {"a": 1}, client_id="c1")
    got: List[Payload] = []
    bus.sub("/topic", got.append)  # replay -> one payload
    bus.pub("/topic", None, client_id="c1")  # clear
    assert got[-1] == Payload(client_id="c1", data=None)

    # A brand-new subscriber gets no replay, since the contribution is gone.
    fresh: List[Payload] = []
    bus.sub("/topic", fresh.append)
    assert fresh == []


def test_bus_remove_client_relays_clear_for_each_topic() -> None:
    bus = PubSubBus()
    got: List[Payload] = []
    bus.sub("/x", got.append)
    bus.sub("/y", got.append)
    bus.pub("/x", 1, client_id="c1")
    bus.pub("/y", 2, client_id="c1")
    got.clear()

    bus.remove_client("c1")
    assert Payload("c1", None) in got
    assert len([p for p in got if p.data is None]) == 2


def test_bus_unsub_stops_delivery() -> None:
    bus = PubSubBus()
    got: List[Payload] = []
    token = bus.sub("/topic", got.append)
    bus.pub("/topic", 1, client_id="c1")
    bus.unsub(token)
    bus.pub("/topic", 2, client_id="c1")
    assert [p.data for p in got] == [1]


# ---------------------------------------------------------------------------
# MergeView
# ---------------------------------------------------------------------------
def test_mergeview_merges_dicts_across_clients() -> None:
    view = MergeView()
    view.apply(Payload("c1", {"user1": {"typing": True}}))
    view.apply(Payload("c2", {"user2": {"typing": True}}))
    assert view.value == {"user1": {"typing": True}, "user2": {"typing": True}}


def test_mergeview_null_key_deletes() -> None:
    view = MergeView()
    view.apply(Payload("c1", {"user1": True}))
    view.apply(Payload("c1", {"user1": None}))
    assert view.value == {}


def test_mergeview_drops_client_contribution_on_none() -> None:
    view = MergeView()
    view.apply(Payload("c1", {"user1": True}))
    view.apply(Payload("c2", {"user2": True}))
    view.apply(Payload("c1", None))  # c1 gone (disconnect)
    assert view.value == {"user2": True}


def test_mergeview_non_dict_replaces() -> None:
    view = MergeView()
    view.apply(Payload("c1", ["a", "b"]))
    view.apply(Payload("c2", ["c"]))
    assert view.value == ["c"]


def test_bus_plus_mergeview_writers_flow() -> None:
    """End-to-end replicated-set: two writers converge, then one leaves."""
    bus = PubSubBus()
    view = MergeView()
    bus.sub("/writers", view.apply)
    bus.pub("/writers", {"user1": {"typing": True}}, client_id="c1")
    bus.pub("/writers", {"user2": {"typing": True}}, client_id="c2")
    assert set(view.value) == {"user1", "user2"}
    bus.remove_client("c1")
    assert set(view.value) == {"user2"}


# ---------------------------------------------------------------------------
# BaseChatModel pub/sub (via WsChatModel)
# ---------------------------------------------------------------------------
def test_model_pub_sub_generic_topic(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    view = MergeView()
    model.sub("/personas/usage", view.apply)
    model.pub("/personas/usage", {"jupyternaut": {"input_tokens": 10}}, client_id="p1")
    assert view.value == {"jupyternaut": {"input_tokens": 10}}


def test_model_remove_client_clears_writers(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    view = MergeView()
    model.sub("/writers", view.apply)
    model.pub("/writers", {"u1": True}, client_id="c1")
    model.pub("/writers", {"u2": True}, client_id="c2")
    model.remove_client("c1")
    assert set(view.value) == {"u2"}


def test_model_unsub_stops_delivery(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    got: List[Payload] = []
    token = model.sub("/settings", got.append)
    model.pub("/settings", {"theme": "dark"}, client_id="c1")
    model.unsub(token)
    model.pub("/settings", {"theme": "light"}, client_id="c1")
    assert [p.data for p in got] == [{"theme": "dark"}]


# ---------------------------------------------------------------------------
# The special /chat/messages topic
# ---------------------------------------------------------------------------
def test_chat_messages_topic_snapshot_and_live(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    model.add_message(NewMessage(body="history", sender="jovyan"))

    got: List[Payload] = []
    token = model.sub(model.CHAT_MESSAGES_TOPIC, got.append)

    # Snapshot: the existing message is replayed on subscribe.
    assert [p.data["body"] for p in got] == ["history"]

    # Live: a new message is delivered as an event payload with its action.
    model.add_message(NewMessage(body="live", sender="agent"))
    assert got[-1].data["body"] == "live"
    assert got[-1].data["action"] == "server_msg_sent"
    assert got[-1].client_id == "agent"

    # After unsub, no more deliveries.
    model.unsub(token)
    model.add_message(NewMessage(body="after", sender="agent"))
    assert [p.data["body"] for p in got] == ["history", "live"]


# ---------------------------------------------------------------------------
# Document topics on WsChatModel (parity with YChat)
# ---------------------------------------------------------------------------
def test_ws_users_document_topic(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    got: List[Payload] = []
    model.sub(model.CHAT_USERS_TOPIC, got.append)
    assert got[-1].data == {}  # snapshot (empty)
    model.pub(model.CHAT_USERS_TOPIC, {"username": "u1", "name": "U1"})
    assert "u1" in got[-1].data and got[-1].data["u1"]["username"] == "u1"


def test_ws_metadata_document_topic(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    got: List[Payload] = []
    model.sub(model.CHAT_METADATA_TOPIC, got.append)
    model.pub(model.CHAT_METADATA_TOPIC, {"default_persona": "jupyternaut"})
    assert got[-1].data.get("default_persona") == "jupyternaut"


def test_ws_pub_message_appends(tmp_path: Path) -> None:
    model = _ws_model(tmp_path)
    model.pub(model.CHAT_MESSAGES_TOPIC, {"body": "hi", "sender": "jovyan"})
    assert [m.body for m in model.get_messages()] == ["hi"]


# ---------------------------------------------------------------------------
# Global channel on ChatManager
# ---------------------------------------------------------------------------
def test_manager_global_channel(tmp_path: Path) -> None:
    mgr = _manager(tmp_path)
    got: List[Payload] = []
    mgr.sub("/settings", got.append)
    mgr.pub("/settings", {"default_chat_dir": "chats/"})
    assert got[-1].data == {"default_chat_dir": "chats/"}
    assert got[-1].client_id == "server"
