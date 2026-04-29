# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from traitlets import Unicode
from traitlets.config.configurable import LoggingConfigurable

try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'jupyterlab_chat' outside a proper installation.")
    __version__ = "dev"


class JupyterlabChat(LoggingConfigurable):
    """Server-side configuration for Jupyter Chat."""

    default_chat_directory = Unicode(
        default_value="",
        help="Default directory for chat files. Empty string means the Jupyter root directory.",
    ).tag(config=True)


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
    name = "jupyterlab_chat"
    server_app.log.info(f"Registered {name} server extension")

    config = JupyterlabChat(parent=server_app)

    page_config = server_app.web_app.settings.setdefault("page_config_data", {})
    page_config["jupyterlabChat"] = {
        "defaultChatDirectory": config.default_chat_directory,
    }
