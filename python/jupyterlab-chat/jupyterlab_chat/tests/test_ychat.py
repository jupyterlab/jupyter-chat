# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# import jupyter_ydoc before YChat to avoid circular error
import jupyter_ydoc

from dataclasses import asdict
import pytest
import time
from uuid import uuid4
from ..models import message_asdict_factory, Message, User
from ..ychat import YChat

USER = User(
    username=str(uuid4()),
    name="Test user",
    display_name="Test user"
)

USER2 = User(
    username=str(uuid4()),
    name="Test user 2",
    display_name="Test user 2"
)


def create_message():
    return Message(
        type="msg",
        id=str(uuid4()),
        body="This is a test message",
        time=time.time(),
        sender=USER.username
    )


def test_initialize_ychat():
    chat = YChat()
    assert chat._get_messages() == []
    assert chat._get_users() == {}
    assert chat.get_metadata() == {}


def test_add_user():
    chat = YChat()
    chat.set_user(USER)
    assert USER.username in chat._get_users().keys()
    assert chat._get_users()[USER.username] == asdict(USER)


def test_get_user_type():
    chat = YChat()
    chat.set_user(USER)
    assert isinstance(chat.get_user(USER.username), User)


def test_get_user():
    chat = YChat()
    chat.set_user(USER)
    chat.set_user(USER2)
    assert chat.get_user(USER.username) == USER
    assert chat.get_user(USER2.username) == USER2
    assert chat.get_user(str(uuid4())) == None


def test_get_user_by_name_type():
    chat = YChat()
    chat.set_user(USER)
    assert isinstance(chat.get_user_by_name(USER.name), User)


def test_get_user_by_name():
    chat = YChat()
    chat.set_user(USER)
    chat.set_user(USER2)
    assert chat.get_user_by_name(USER.name) == USER
    assert chat.get_user_by_name(USER2.name) == USER2
    assert chat.get_user_by_name(str(uuid4())) == None


def test_add_message():
    chat = YChat()
    msg = create_message()
    chat.add_message(msg)
    assert len(chat._get_messages()) == 1
    assert chat._get_messages()[0] == asdict(msg, dict_factory=message_asdict_factory)


def test_get_message_type():
    chat = YChat()
    msg = create_message()
    chat.add_message(msg)
    assert isinstance(chat.get_message(msg.id)[0], Message)


def test_get_message():
    chat = YChat()
    msg = create_message()
    chat.add_message(msg)
    assert chat.get_message(msg.id) == (msg, 0)


def test_set_message_should_add():
    chat = YChat()
    msg = create_message()
    chat.set_message(msg)
    assert len(chat._get_messages()) == 1
    assert chat._get_messages()[0] == asdict(msg, dict_factory=message_asdict_factory)


def test_set_message_should_update():
    chat = YChat()
    msg = create_message()
    index = chat.add_message(msg)
    msg.body = "Updated content"
    chat.set_message(msg, index)
    assert len(chat._get_messages()) == 1
    assert chat._get_messages()[0] == asdict(msg, dict_factory=message_asdict_factory)


def test_set_message_should_add_with_new_id():
    chat = YChat()
    msg = create_message()
    index = chat.add_message(msg)
    new_msg = Message(**asdict(msg))
    new_msg.id = str(uuid4())
    new_msg.body = "Updated content"
    chat.set_message(new_msg, index)
    assert len(chat._get_messages()) == 2
    assert chat._get_messages()[0] == asdict(msg, dict_factory=message_asdict_factory)
    assert chat._get_messages()[1] == asdict(new_msg, dict_factory=message_asdict_factory)


def test_set_message_should_update_with_wrong_index():
    chat = YChat()
    msg = create_message()
    chat.add_message(msg)
    new_msg = create_message()
    new_msg.body = "New content"
    index = chat.add_message(new_msg)
    assert index == 1
    new_msg.body = "Updated content"
    chat.set_message(new_msg, 0)
    assert len(chat._get_messages()) == 2
    assert chat._get_messages()[0] == asdict(msg, dict_factory=message_asdict_factory)
    assert chat._get_messages()[1] == asdict(new_msg, dict_factory=message_asdict_factory)
