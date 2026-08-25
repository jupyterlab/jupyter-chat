# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Tests for the RTC-free WebSocket handler path encoding and connection guards."""

import base64

from jupyterlab_chat.websocket_handler import WSChatHandler, decode_chat_path


def _urlsafe_b64_no_pad(text: str) -> str:
    """Encode like the frontend does: URL-safe base64 without padding."""
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")


def test_decode_chat_path_roundtrips_paths_with_slashes():
    path = "some/nested/folder/my chat.chat"
    assert decode_chat_path(_urlsafe_b64_no_pad(path)) == path


def test_decode_chat_path_roundtrips_unicode():
    path = "café/notebooks/чат.chat"
    assert decode_chat_path(_urlsafe_b64_no_pad(path)) == path


def test_decode_chat_path_empty_segment_returns_empty():
    assert decode_chat_path("") == ""


def test_decode_chat_path_invalid_segment_returns_empty():
    # Not valid base64url -> treated as "no path" rather than raising.
    assert decode_chat_path("@@@not-base64@@@") == ""


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
