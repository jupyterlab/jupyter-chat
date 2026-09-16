# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Tests for the collaborative (YChat) writing-status awareness relay.

Server-side senders (e.g. AI personas) have no awareness client of their own, so
``YChat.broadcast_writing_status`` publishes the whole set of current writers as
a list under the document's own awareness slot (the ``writers`` field). The
frontend scans every awareness slot for that field and merges it into the single
``writersChanged`` signal, so RTC and RTC-free consumers read from one source.
"""

from dataclasses import asdict

from pycrdt import Awareness

from ..models import BaseChatModel, User
from ..ychat import WRITERS_AWARENESS_KEY, YChat

BOT = User(username="bot", name="bot", display_name="Bot Agent", bot=True)
BOT2 = User(username="bot-2", name="bot-2", display_name="Second Bot", bot=True)


def _chat_with_room_awareness() -> YChat:
    """A YChat with an attached awareness, as a collaboration room provides."""
    chat = YChat()
    chat.awareness = Awareness(ydoc=chat._ydoc)
    return chat


def _published_writers(chat: YChat) -> list:
    """The writer set the document currently publishes on its own slot."""
    awareness = chat.awareness
    assert awareness is not None
    state = awareness.get_local_state() or {}
    return state.get(WRITERS_AWARENESS_KEY, [])


def test_broadcast_writing_status_is_abstract():
    """The base model must not be instantiable without an implementation, so a
    future transport cannot silently inherit a no-op again."""
    assert getattr(
        BaseChatModel.broadcast_writing_status, "__isabstractmethod__", False
    )


def test_writing_status_with_message_id():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"messageID": "msg-1"})

    writers = _published_writers(chat)
    assert writers == [{"user": asdict(BOT), "messageID": "msg-1"}]


def test_writing_status_without_message_id():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"typingIndicator": "Writing..."})

    writers = _published_writers(chat)
    assert writers == [{"user": asdict(BOT), "typingIndicator": "Writing..."}]


def test_writing_status_preserves_all_user_fields():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"messageID": "m1"})

    writers = _published_writers(chat)
    assert writers == [{"user": asdict(BOT), "messageID": "m1"}]
    # The full User is serialized (asdict), so bot survives for consumers that
    # distinguish AI writers from humans.
    assert writers[0]["user"]["bot"] is True


def test_stop_removes_writer_from_the_set():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"messageID": "m1"})
    assert len(_published_writers(chat)) == 1

    chat.broadcast_writing_status(BOT, None)
    assert _published_writers(chat) == []


def test_same_user_reuses_one_entry():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"messageID": "m1"})
    chat.broadcast_writing_status(BOT, {"messageID": "m2"})

    writers = _published_writers(chat)
    assert len(writers) == 1
    assert writers[0]["messageID"] == "m2"


def test_concurrent_writers_share_one_slot():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"messageID": "m1"})
    chat.broadcast_writing_status(BOT2, {"messageID": "m2"})

    writers = _published_writers(chat)
    assert len(writers) == 2
    by_user = {w["user"]["username"]: w["messageID"] for w in writers}
    assert by_user == {"bot": "m1", "bot-2": "m2"}

    # Stopping one writer must not clear the other.
    chat.broadcast_writing_status(BOT, None)
    writers = _published_writers(chat)
    assert [w["user"]["username"] for w in writers] == ["bot-2"]


def test_writing_status_is_not_persisted():
    chat = _chat_with_room_awareness()
    chat.broadcast_writing_status(BOT, {"messageID": "m1"})

    # Ephemeral: writing status lives only in awareness, never in the document.
    assert chat._get_messages() == []
    assert chat.get_metadata() == {}
    assert chat._get_users() == {}


def test_no_awareness_is_a_noop():
    """Before a room attaches (awareness is None), broadcasting must not raise;
    the writer is tracked and published once awareness is available."""
    chat = YChat()
    assert chat.awareness is None
    chat.broadcast_writing_status(BOT, {"messageID": "m1"})  # must not raise

    chat.awareness = Awareness(ydoc=chat._ydoc)
    chat.broadcast_writing_status(BOT2, {"messageID": "m2"})
    usernames = {w["user"]["username"] for w in _published_writers(chat)}
    assert usernames == {"bot", "bot-2"}
