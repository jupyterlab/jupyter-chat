# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# Import `jupyter_ydoc` before anything imports `jupyterlab_chat.ychat`.
#
# `jupyter_ydoc`'s package init eagerly loads every registered `jupyter_ydoc`
# entry point, one of which is `chat = jupyterlab_chat.ychat:YChat`. If
# `jupyterlab_chat.ychat` is the first module to touch `jupyter_ydoc` (via its
# top-level `from jupyter_ydoc.ybasedoc import YBaseDoc`), that eager load
# re-enters the still-initializing `ychat` module before `YChat` is defined and
# raises a circular-import AttributeError. Importing `jupyter_ydoc` here forces
# its entry-point registry to finish first, since this package `__init__` always
# runs before the `ychat` submodule.
import jupyter_ydoc  # noqa: F401

from jupyter_server.utils import url_path_join

from .models import BaseChatModel  # noqa: F401
from .rtc_lib import (  # noqa: F401
    RTC_PROVIDERS,
    RTCProvider,
    ServerSessionRtcInfo,
    get_rtc_provider,
    get_server_session_rtc_info,
    publish_rtc_info,
)
from .websocket_handler import WSChatHandler  # noqa: F401

try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'jupyterlab_chat' outside a proper installation.")
    __version__ = "dev"


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "jupyterlab-chat-extension"
    }]


def _jupyter_server_extension_points():
    return [{
        "module": "jupyterlab_chat"
    }]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.
    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    # Resolve whether an RTC provider is active this session and advertise the
    # decision to the frontend via PageConfig. See jupyterlab_chat.rtc_lib.
    rtc_info = publish_rtc_info(server_app)

    # Create the transport-agnostic chat manager (event bus + model registry +
    # memory management). Under RTC it forwards jupyter_collaboration room events;
    # under WebSocket it backs the WS handler (owns ``ws_chat_models``).
    from .events import ChatManager

    chat_manager = ChatManager(server_app, rtc_enabled=rtc_info.enabled)
    server_app.web_app.settings["chat_manager"] = chat_manager

    # When RTC is off, chat runs over the plain WebSocket handler. When an RTC
    # provider is active, the collaborative (YChat) backend serves chat instead.
    if not rtc_info.enabled:
        base_url = server_app.web_app.settings.get("base_url", "/")
        server_app.web_app.add_handlers(".*$", [
            (url_path_join(base_url, "api/jupyter-chat/ws"), WSChatHandler),
        ])

    name = "jupyterlab_chat"
    server_app.log.info(
        f"Registered {name} server extension "
        f"(RTC provider: {rtc_info.provider or 'none'})"
    )
