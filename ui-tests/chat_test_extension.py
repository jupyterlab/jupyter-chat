# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Test-only server extension for the UI tests.

Exposes three endpoints used by the E2E suite:

* ``POST /chat-test/add-user`` -- add a user to a *live* chat the way an AI
  persona does (``chat.set_user()`` on the server, after clients connected), so
  a test can assert the clients' user list updates. Transport-agnostic.
* ``GET /chat-test/chat-alive?path=<path>`` -- report whether a chat model is
  still held in memory by the ``ChatManager`` (read-only liveness probe).
* ``POST /chat-test/keep-alive`` ``{path, seconds}`` -- pin a chat with
  ``WsChatModel.keep_alive()`` for ``seconds`` then send a message, simulating a
  server-side producer that must outlive the connected clients.

``add-user`` resolves the live model from the ``ChatManager`` by path, which is a
``WsChatModel`` under the RTC-free WebSocket transport and a ``YChat`` under
real-time collaboration. The liveness/keep-alive endpoints are specific to the
WebSocket memory model and are only exercised by ``@websocket``-tagged tests.

!! Never enable this in production: it lets any authenticated caller inject
arbitrary users into a chat and hold chats in memory.
"""
from __future__ import annotations

import asyncio
import json

import tornado
from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.utils import url_path_join

from jupyterlab_chat.models import NewMessage, User


class AddUserHandler(JupyterHandler):
    @tornado.web.authenticated
    async def post(self) -> None:
        body = json.loads(self.request.body or b"{}")
        path = body["path"]
        fields = body["user"]

        manager = self.settings["chat_manager"]
        # The chat may not be live yet (RTC rooms initialize asynchronously after
        # the client opens the document), so retry briefly.
        model = None
        for _ in range(100):
            model = await manager.create(path)
            if model is not None:
                break
            await asyncio.sleep(0.1)
        if model is None:
            raise tornado.web.HTTPError(404, f"chat not live: {path}")

        model.set_user(User(**fields))
        self.finish(json.dumps({"ok": True}))


class ChatAliveHandler(JupyterHandler):
    """``GET /chat-test/chat-alive?path=<path>`` -> ``{"alive": bool}``.

    Read-only liveness probe: reports whether a chat model for ``path`` is
    currently held in memory by the ``ChatManager``. It must NOT create the model
    (that would resurrect a freed chat), so it scans the live registry by path
    instead of calling ``ChatManager.create``.
    """

    @tornado.web.authenticated
    async def get(self) -> None:
        path = self.get_query_argument("path")
        chats_by_id = self.settings.get("chats_by_id", {})
        alive = any(model.get_path() == path for model in chats_by_id.values())
        self.finish(json.dumps({"alive": alive}))


class KeepAliveHandler(JupyterHandler):
    """``POST /chat-test/keep-alive`` ``{path, seconds}`` -> ``{"ok": true}``.

    Simulates a server-side producer (e.g. an AI persona) that must outlive the
    connected clients: it opens a ``WsChatModel.keep_alive()`` context, waits
    ``seconds`` (during which the client may disconnect), then sends a message
    and exits the context. It runs in the background so the request returns
    immediately; the caller then closes the client tab and observes the chat
    staying alive until the context resolves.
    """

    @tornado.web.authenticated
    async def post(self) -> None:
        body = json.loads(self.request.body or b"{}")
        path = body["path"]
        seconds = float(body.get("seconds", 5))

        manager = self.settings["chat_manager"]
        model = await manager.create(path)
        if model is None:
            raise tornado.web.HTTPError(404, f"chat not live: {path}")

        async def _run() -> None:
            with model.keep_alive():
                await asyncio.sleep(seconds)
                model.add_message(NewMessage(body="Hi", sender="server-bot"))

        asyncio.ensure_future(_run())
        self.finish(json.dumps({"ok": True}))


def _jupyter_server_extension_points():
    return [{"module": "chat_test_extension"}]


def _load_jupyter_server_extension(server_app) -> None:
    web_app = server_app.web_app
    base_url = web_app.settings["base_url"]
    web_app.add_handlers(
        ".*$",
        [
            (url_path_join(base_url, "chat-test", "add-user"), AddUserHandler),
            (url_path_join(base_url, "chat-test", "chat-alive"), ChatAliveHandler),
            (url_path_join(base_url, "chat-test", "keep-alive"), KeepAliveHandler),
        ],
    )
    server_app.log.info(
        "Registered chat_test_extension (test-only add-user/chat-alive/keep-alive endpoints)"
    )
