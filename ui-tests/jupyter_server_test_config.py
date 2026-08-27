# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)

# The RTC-free chat WebSocket derives the sender identity from the server's
# authenticated user, and the client adopts that same identity. The default
# identity provider mints a *random* anonymous user on each generation, so the
# REST (`/api/me`) identity and the chat WebSocket identity could differ and
# were not reproducible. Return a single fixed user instead: this keeps the two
# identical and stable (deterministic screenshots and ownership checks), and it
# matches the `USER` constant the frontend tests use. Patching the method on the
# base class (rather than swapping the provider class) preserves the auth
# configuration galata already applied.
from jupyter_server.auth.identity import IdentityProvider, User


def _fixed_anonymous_user(self, handler):
    return User(
        username="test-user",
        name="jovyan",
        display_name="jovyan",
        initials="JP",
        avatar_url=None,
        color="var(--jp-collaborator-color1)",
    )


IdentityProvider.generate_anonymous_user = _fixed_anonymous_user

# Bind a configurable port (defaults to 8888, unchanged) so a parallel
# worktree/checkout can run the suite on its own port. Kept in sync with
# TEST_PORT in playwright.config.js.
import os

c.ServerApp.port = int(os.environ.get("TEST_PORT", "8888"))

c.FileContentsManager.delete_to_trash = False

# Enable the test-only server extension that exposes POST /chat-test/add-user
# (see chat_test_extension.py), used by user-updates.spec.ts to add a user to a
# live chat via chat.set_user() and verify the client's user list updates. This
# config file's directory is not importable by default, so put it on sys.path.
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
c.ServerApp.jpserver_extensions = {"chat_test_extension": True}

# Reclaim RTC-free chat models quickly in tests so ws-chats-freed.spec.ts can
# observe a chat being freed shortly after its last client disconnects (the
# production default is 5 minutes). This only affects the WebSocket WsChatModel
# path; YChat memory is managed by jupyter-collaboration, so the collaborative
# CI legs are unaffected.
c.ChatManager.inactivity_timeout_s = 2.0
c.ChatManager.poll_interval_s = 1.0

# Each UI test runs in its own temporary directory, but all documents handled by
# the server otherwise share the same SQLite YStore. Use one temporary file per
# document so parallel tests do not contend for a database lock.
c.YDocExtension.ystore_class = "jupyter_server_ydoc.stores.TempFileYStore"

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"
