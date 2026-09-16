# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""RTC integration matrix for jupyterlab_chat.

Runs the SAME integration test module (``jupyterlab_chat/tests/rtc_integration``)
under three different dependency sets. Each session installs its packages and
injects the expected provider via ``EXPECTED_RTC_PROVIDER``; the test asserts the
real server publishes a matching ``serverSessionRtcInfo`` (plus env-invariant
checks).

Usage::

    nox -l                     # list sessions
    nox -s rtc_integration     # run all three environments
    nox -s "rtc_integration(env='no_rtc')"   # run one

The RTC-free logic itself is covered by fast unit tests
(``jupyterlab_chat/tests/test_rtc_lib.py``); this matrix only validates the real
wiring against jupyter_server with each provider actually installed.
"""
import nox

# Prefer uv for fast env creation, fall back to virtualenv.
nox.options.default_venv_backend = "uv|virtualenv"

_PKG = "python/jupyterlab-chat"
_INTEGRATION = f"{_PKG}/jupyterlab_chat/tests/rtc_integration"

# env name -> (expected provider or None, extra packages providing that RTC backend)
_RTC_ENVS = {
    "no_rtc": (None, []),
    "rtc_jcollab": ("jupyter_server_ydoc", ["jupyter_collaboration>=4,<6"]),
    "rtc_jsd": ("jupyter_server_documents", ["jupyter_server_documents"]),
}


@nox.session
def unit(session: nox.Session) -> None:
    """Fast RTC-free unit tests (no real provider, no server boot)."""
    session.env["SKIP_JUPYTER_BUILDER"] = "1"
    session.install("-e", f"{_PKG}[test]")
    session.run(
        "pytest", f"{_PKG}/jupyterlab_chat/tests/test_rtc_lib.py", "-vv"
    )


@nox.session
@nox.parametrize("env", list(_RTC_ENVS))
def rtc_integration(session: nox.Session, env: str) -> None:
    expected, extra = _RTC_ENVS[env]
    # These tests exercise only the Python server extension; skip the JS
    # labextension build (irrelevant here, and it needs node/network). For
    # editable installs hatch-jupyter-builder ignores skip-if-exists, so the
    # SKIP_JUPYTER_BUILDER env var is the reliable lever.
    session.env["SKIP_JUPYTER_BUILDER"] = "1"
    # jupyterlab is needed to render the /lab page for the network-level test.
    session.install("-e", f"{_PKG}[test]", "jupyterlab", *extra)
    session.run(
        "pytest",
        _INTEGRATION,
        "-v",
        "-p",
        "pytest_jupyter.jupyter_server",
        # RTC_INTEGRATION gates the module on; EXPECTED_RTC_PROVIDER is the
        # per-environment expected provider the test asserts against.
        env={"RTC_INTEGRATION": "1", "EXPECTED_RTC_PROVIDER": expected or ""},
    )
