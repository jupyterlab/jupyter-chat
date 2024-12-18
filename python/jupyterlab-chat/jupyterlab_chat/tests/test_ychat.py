# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# import jupyter_ydoc before YChat to avoid circular error
import jupyter_ydoc

from dataclasses import asdict
import pytest
from uuid import uuid4
from ..models import message_asdict_factory, Message, NewMessage, User
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


def create_new_message(body="This is a test message") -> NewMessage:
    return NewMessage(
        body=body,
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
    msg = create_new_message()
    chat.add_message(msg)
    assert len(chat._get_messages()) == 1
    message_dict = chat._get_messages()[0]
    assert message_dict["body"] == msg.body
    assert message_dict["sender"] == msg.sender


def test_get_message_should_return_the_message():
    chat = YChat()
    msg = create_new_message()
    id = chat.add_message(msg)
    msg2 = create_new_message("Another message")
    id2 = chat.add_message(msg2)
    message = chat.get_message(id)
    assert isinstance(message, Message)
    assert message.body == msg.body
    assert message.sender == msg.sender
    message2 = chat.get_message(id2)
    assert isinstance(message2, Message)
    assert message2.body == msg2.body


def test_get_message_should_return_None():
    chat = YChat()
    msg = create_new_message()
    chat.add_message(msg)
    assert chat.get_message(str(uuid4())) is None


def test_update_message():
    chat = YChat()
    msg = create_new_message()
    chat.add_message(msg)
    new_msg = Message(**chat._get_messages()[0])
    new_msg.body = "Updated content"
    chat.update_message(new_msg)
    assert len(chat._get_messages()) == 1
    message_dict = chat._get_messages()[0]
    assert message_dict["body"] == new_msg.body
    assert message_dict["sender"] == new_msg.sender


def test_update_message_should_append_content():
    content_to_append = " with updated content"
    chat = YChat()
    msg = create_new_message()
    chat.add_message(msg)
    new_msg = Message(**chat._get_messages()[0])
    new_msg.body = content_to_append
    chat.update_message(new_msg, True)
    assert len(chat._get_messages()) == 1
    message_dict = chat._get_messages()[0]
    assert message_dict["body"] == msg.body + content_to_append
    assert message_dict["sender"] == msg.sender


def test_indexes_by_id():
    chat = YChat()
    msg = create_new_message()
    id = chat.add_message(msg)
    id2 = chat.add_message(msg)
    assert chat._indexes_by_id == {
        id: 0,
        id2: 1
    }
