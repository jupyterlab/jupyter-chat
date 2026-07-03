# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import subprocess
import sys


def test_import_ychat_standalone():
    """`jupyterlab_chat.ychat` must be importable on its own.

    `ychat.py` imports from `jupyter_ydoc`, whose package init eagerly loads all
    `jupyter_ydoc` entry points -- one of which is `chat = jupyterlab_chat.ychat:YChat`.
    If `jupyterlab_chat.ychat` is the first module to touch `jupyter_ydoc`, that
    eager load re-enters the still-initializing `ychat` module and fails with a
    circular import. This is run in a fresh subprocess so no earlier import in
    the test session masks the problem.
    """
    result = subprocess.run(
        [sys.executable, "-c", "import jupyterlab_chat.ychat"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Importing jupyterlab_chat.ychat failed:\n" + result.stderr
    )
