# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Test-only server extension for the UI tests.

Exposes ``POST /chat-test/add-user`` so an E2E test can add a user to a *live*
chat the way an AI persona does -- ``chat.set_user()`` on the server, after web
clients have already connected -- and then assert the clients' user list updates.

It is transport-agnostic: it resolves the live model from the ``ChatManager`` by
path, which is a ``WsChatModel`` under the RTC-free WebSocket transport and a
``YChat`` under real-time collaboration. In both cases ``set_user`` propagates to
connected clients (a WS broadcast, or a shared-document write).

!! Never enable this in production: it lets any authenticated caller inject
arbitrary users into a chat.
"""
from __future__ import annotations

import asyncio
import json

import tornado
from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.utils import url_path_join

from jupyterlab_chat.models import User


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


def _jupyter_server_extension_points():
    return [{"module": "chat_test_extension"}]


def _load_jupyter_server_extension(server_app) -> None:
    web_app = server_app.web_app
    base_url = web_app.settings["base_url"]
    route = url_path_join(base_url, "chat-test", "add-user")
    web_app.add_handlers(".*$", [(route, AddUserHandler)])
    server_app.log.info("Registered chat_test_extension (test-only add-user endpoint)")
