# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Fixtures for the RTC integration matrix.

These tests boot a *real* jupyter_server (via pytest-jupyter's ``jp_serverapp``)
with the ``jupyterlab_chat`` server extension enabled, plus whichever RTC
provider is installed in the current environment. The same test module runs
unchanged in every matrix environment; only the set of installed packages (and
the injected ``EXPECTED_RTC_PROVIDER``) differs. See ``noxfile.py``.

The ``pytest_jupyter.jupyter_server`` plugin is loaded explicitly on the pytest
command line (``-p pytest_jupyter.jupyter_server``) rather than via
``pytest_plugins`` here, because ``pytest_plugins`` is only allowed in a
top-level conftest.
"""
from __future__ import annotations

import importlib.util

import pytest
from traitlets.config import Config

_RTC_PROVIDERS = ("jupyter_server_ydoc", "jupyter_server_documents")


@pytest.fixture
def jp_server_config():
    """Enable ``jupyterlab_chat`` and any *installed* RTC provider.

    This is environment-adaptive setup (not an assertion): each matrix env has
    exactly one provider installed, so the resolved provider reflects the env.
    The expected outcome is asserted separately from ``EXPECTED_RTC_PROVIDER``.
    """
    extensions = {"jupyterlab_chat": True}
    # Enable jupyterlab too (if installed) so the `/lab` page -- which embeds
    # page_config_data for the browser -- can be rendered by the network test.
    if importlib.util.find_spec("jupyterlab") is not None:
        extensions["jupyterlab"] = True
    for name in _RTC_PROVIDERS:
        if importlib.util.find_spec(name) is not None:
            extensions[name] = True
    return Config({"ServerApp": {"jpserver_extensions": extensions}})
