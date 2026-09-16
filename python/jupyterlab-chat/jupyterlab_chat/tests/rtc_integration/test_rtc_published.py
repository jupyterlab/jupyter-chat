# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""End-to-end RTC detection against a real jupyter_server.

One test module, run unchanged in every matrix environment. The only
environment-specific input is ``EXPECTED_RTC_PROVIDER``, injected by the nox
session that installs that environment's dependency set. Everything else is an
environment-invariant assertion.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re

import pytest

from jupyterlab_chat.rtc_lib import PAGE_CONFIG_KEY, get_server_session_rtc_info

#: Injected by the matrix (noxfile). Empty/unset means "no RTC provider expected".
EXPECTED_RTC_PROVIDER = os.environ.get("EXPECTED_RTC_PROVIDER") or None

# These tests assert an environment-specific expectation and must run once per
# dependency set (see noxfile.py). Skip them under a generic ``pytest`` run
# (e.g. the shared python unit-test job) where the expected provider is not
# injected; the dedicated matrix sets RTC_INTEGRATION=1.
pytestmark = pytest.mark.skipif(
    os.environ.get("RTC_INTEGRATION") != "1",
    reason="RTC integration matrix; run via `nox -s rtc_integration` (sets RTC_INTEGRATION=1)",
)


def test_server_publishes_rtc_info(jp_serverapp):
    """The loaded jupyterlab_chat extension must publish serverSessionRtcInfo,
    and the resolved provider must match this environment's expectation."""
    page_config = jp_serverapp.web_app.settings.get("page_config_data", {})
    assert PAGE_CONFIG_KEY in page_config, (
        f"{PAGE_CONFIG_KEY!r} not published -- the jupyterlab_chat server "
        "extension may not have loaded"
    )
    published = page_config[PAGE_CONFIG_KEY]

    # --- the single environment-specific assertion (value injected by matrix) ---
    assert published["provider"] == EXPECTED_RTC_PROVIDER

    # Recompute from the live serverapp; the published payload must match.
    assert get_server_session_rtc_info(jp_serverapp).to_page_config() == published

    # --- environment-invariant assertions (identical in every env) ---
    assert published["enabled"] == (published["provider"] is not None)
    if published["provider"] is not None:
        details = published["providerDetails"]
        # an active provider must satisfy BOTH axes
        assert published["provider"] in details["enabledByServer"]
        assert published["provider"] in details["enabledByTrait"]
    # always JSON-serializable (it is sent to the browser via PageConfig)
    json.dumps(published)


_CONFIG_DATA_RE = re.compile(
    r'<script id="jupyter-config-data" type="application/json">(.*?)</script>',
    re.DOTALL,
)


def test_rtc_info_reaches_browser_via_lab_page(jp_fetch, jp_asyncio_loop):
    """Assert the info actually crosses the wire, not just server settings.

    jupyterlab_server embeds ``web_app.settings["page_config_data"]`` into the
    ``/lab`` HTML inside ``<script id="jupyter-config-data">`` -- the exact blob
    the frontend's ``PageConfig.getOption()`` reads. Here we make a real HTTP
    request for that page and parse the embedded JSON.

    pytest-jupyter's client/server share ``jp_asyncio_loop``; per its docs we
    drive the async ``jp_fetch`` with ``run_until_complete`` from a sync test
    (it does not run ``async def`` tests itself).
    """
    if importlib.util.find_spec("jupyterlab") is None:
        pytest.skip("jupyterlab not installed; cannot render the /lab page")

    response = jp_asyncio_loop.run_until_complete(jp_fetch("lab", method="GET"))
    assert response.code == 200
    html = response.body.decode("utf-8")

    match = _CONFIG_DATA_RE.search(html)
    assert match, "jupyter-config-data script tag not found in the /lab HTML"
    page_config = json.loads(match.group(1))

    assert PAGE_CONFIG_KEY in page_config, (
        f"{PAGE_CONFIG_KEY!r} not embedded in the browser-facing page config"
    )
    assert page_config[PAGE_CONFIG_KEY]["provider"] == EXPECTED_RTC_PROVIDER

