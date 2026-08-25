# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Tests for the RTC-free WebSocket handler connection guards."""

from jupyterlab_chat.websocket_handler import WSChatHandler


def test_path_is_instance_attribute_not_class_default():
    # `_path` is a plain annotation with no class-level default; `initialize()`
    # sets it as an instance attribute so it always resolves.
    assert "_path" not in vars(WSChatHandler)
    handler = WSChatHandler.__new__(WSChatHandler)
    handler.initialize()
    assert handler._path == ""


def test_on_close_is_noop_when_connection_never_opened():
    """A connection that closes before ``open()`` set ``_path`` must not raise.

    ``initialize()`` sets ``_path`` to "" as an instance attribute, so
    ``on_close`` reads it safely and returns early instead of raising
    ``AttributeError``.
    """
    handler = WSChatHandler.__new__(WSChatHandler)
    handler.initialize()
    handler.on_close()  # no-op, no exception
