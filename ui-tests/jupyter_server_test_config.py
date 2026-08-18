# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)

# Bind a configurable port (defaults to 8888, unchanged) so a parallel
# worktree/checkout can run the suite on its own port. Kept in sync with
# TEST_PORT in playwright.config.js.
import os

c.ServerApp.port = int(os.environ.get("TEST_PORT", "8888"))

c.FileContentsManager.delete_to_trash = False

# Each UI test runs in its own temporary directory, but all documents handled by
# the server otherwise share the same SQLite YStore. Use one temporary file per
# document so parallel tests do not contend for a database lock.
c.YDocExtension.ystore_class = "jupyter_server_ydoc.stores.TempFileYStore"

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"
