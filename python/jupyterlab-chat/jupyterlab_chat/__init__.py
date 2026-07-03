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
    name = "jupyterlab_chat"
    server_app.log.info(f"Registered {name} server extension")
