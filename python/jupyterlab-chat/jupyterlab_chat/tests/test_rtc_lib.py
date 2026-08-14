# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Unit tests for ``jupyterlab_chat.rtc_lib``.

These are pure unit tests: RTC provider detection reads the environment only
through ``_is_installed`` (module import check) and the ``ServerApp``'s
``extension_manager`` (which extensions are enabled + their live app instances).
Both are simulated here with a fake ``ServerApp`` and a monkeypatched
``_is_installed``, so the full resolution logic is exercised without installing
any RTC provider or booting a real server.

Verifying the *real* wiring (a live jupyter_server with jupyter_collaboration or
jupyter_server_documents actually installed) is a separate, heavier integration
concern -- see the module-level note in the test for the recommended approach.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

import pytest
from traitlets.config import Application

from jupyterlab_chat import rtc_lib

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp


# --- Fakes -------------------------------------------------------------------


def make_serverapp(*, extensions=None, apps=None, config=None) -> "ServerApp":
    """Build a fake ServerApp exposing just what rtc_lib inspects.

    Parameters
    ----------
    extensions : dict[str, bool] | None
        Map of extension module name -> ``enabled`` flag, mirroring
        ``extension_manager.extensions``.
    apps : dict[str, set] | None
        Map of extension module name -> set of live app instances, mirroring
        ``extension_manager.extension_apps``.
    config : dict | None
        Stands in for ``serverapp.config``.
    """
    exts = {
        name: SimpleNamespace(enabled=enabled)
        for name, enabled in (extensions or {}).items()
    }
    manager = SimpleNamespace(extensions=exts, extension_apps=(apps or {}))
    return cast(
        "ServerApp",
        SimpleNamespace(
            extension_manager=manager,
            config=(config or {}),
            web_app=SimpleNamespace(settings={}),
        ),
    )


def ydoc_app(*, disable_rtc):
    """A minimal, hashable stand-in for a live YDocExtension instance.

    ``extension_manager.extension_apps`` values are *sets* of app instances, so
    the stand-in must be hashable (``SimpleNamespace`` is not).
    """
    class _FakeYDocApp:
        def __init__(self, disable_rtc):
            self.disable_rtc = disable_rtc

    return _FakeYDocApp(disable_rtc)


def cli_config(argv):
    """Real traitlets config as produced by CLI parsing.

    With no class registered, ``--YDocExtension.disable_rtc=False`` is stored as
    a ``DeferredConfigString('False')`` -- a ``str`` subclass -- which is exactly
    the value rtc_lib must coerce correctly.
    """
    app = Application()
    app.initialize(argv)
    return app.config


# --- get_rtc_provider: core resolution ---------------------------------------


def test_no_providers_means_rtc_off():
    sa = make_serverapp()
    assert rtc_lib.get_rtc_provider(sa) is None


def test_jsy_enabled_is_active():
    sa = make_serverapp(extensions={"jupyter_server_ydoc": True})
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_ydoc"


def test_jsy_installed_but_extension_disabled_is_off():
    sa = make_serverapp(extensions={"jupyter_server_ydoc": False})
    assert rtc_lib.get_rtc_provider(sa) is None


def test_jsd_enabled_is_active():
    sa = make_serverapp(extensions={"jupyter_server_documents": True})
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_documents"


def test_both_enabled_jsd_wins():
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True, "jupyter_server_documents": True}
    )
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_documents"


# --- disable_rtc trait handling ----------------------------------------------


def test_jsy_disabled_by_trait_via_live_instance():
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True},
        apps={"jupyter_server_ydoc": {ydoc_app(disable_rtc=True)}},
    )
    assert rtc_lib.is_rtc_disabled_by_trait(sa) is True
    assert rtc_lib.get_rtc_provider(sa) is None


def test_jsy_enabled_when_instance_says_not_disabled():
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True},
        apps={"jupyter_server_ydoc": {ydoc_app(disable_rtc=False)}},
    )
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_ydoc"


def test_disable_rtc_trait_is_jsd_agnostic():
    """The YDoc-only trait must not switch off an active JSD provider."""
    sa = make_serverapp(
        extensions={"jupyter_server_documents": True},
        config={"YDocExtension": {"disable_rtc": True}},
    )
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_documents"


def test_live_instance_value_beats_stale_config():
    """A coerced instance value takes precedence over raw config."""
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True},
        apps={"jupyter_server_ydoc": {ydoc_app(disable_rtc=False)}},
        config={"YDocExtension": {"disable_rtc": True}},  # contradicts instance
    )
    assert rtc_lib.is_rtc_disabled_by_trait(sa) is False
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_ydoc"


# --- Regression: DeferredConfigString from CLI must not be misread -----------


def test_cli_disable_rtc_false_keeps_rtc_on_regression():
    """`--YDocExtension.disable_rtc=False` must NOT disable RTC.

    Regression for the bug where the value arrives as
    ``DeferredConfigString('False')`` (a non-empty str) and a naive ``bool(...)``
    evaluates to True, wrongly turning RTC off. No live instance here, so the
    config-coercion fallback is what's under test.
    """
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True},
        config=cli_config(["--YDocExtension.disable_rtc=False"]),
    )
    assert rtc_lib.is_rtc_disabled_by_trait(sa) is False
    assert rtc_lib.get_rtc_provider(sa) == "jupyter_server_ydoc"


def test_cli_disable_rtc_true_turns_rtc_off():
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True},
        config=cli_config(["--YDocExtension.disable_rtc=True"]),
    )
    assert rtc_lib.is_rtc_disabled_by_trait(sa) is True
    assert rtc_lib.get_rtc_provider(sa) is None


@pytest.mark.parametrize(
    "value,expected",
    [
        (True, True),
        (False, False),
        ("True", True),
        ("False", False),  # the dangerous case: non-empty str
        ("true", True),
        ("false", False),
        ("1", True),
        ("0", False),
        ("", False),
        (1, True),
        (0, False),
    ],
)
def test_coerce_bool(value, expected):
    assert rtc_lib._coerce_bool(value) is expected


# --- ServerSessionRtcInfo shape ----------------------------------------------


def test_enabled_by_trait_always_includes_jsd():
    sa = make_serverapp(config={"YDocExtension": {"disable_rtc": True}})
    info = rtc_lib.get_server_session_rtc_info(sa)
    assert "jupyter_server_documents" in info.providerDetails.enabledByTrait
    assert "jupyter_server_ydoc" not in info.providerDetails.enabledByTrait


def test_enabled_split_when_jsy_disabled_by_trait():
    """JSY enabled as a server extension but disabled by trait: it appears in
    enabledByServer but not enabledByTrait, so no provider is active."""
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True},
        apps={"jupyter_server_ydoc": {ydoc_app(disable_rtc=True)}},
    )
    info = rtc_lib.get_server_session_rtc_info(sa)
    assert info.enabled is False
    assert info.provider is None
    assert info.providerDetails.enabledByServer == ["jupyter_server_ydoc"]
    assert "jupyter_server_ydoc" not in info.providerDetails.enabledByTrait


def test_installed_reflects_import_probe(monkeypatch):
    monkeypatch.setattr(
        rtc_lib, "_is_installed", lambda name: name == "jupyter_server_ydoc"
    )
    sa = make_serverapp()
    info = rtc_lib.get_server_session_rtc_info(sa)
    assert info.providerDetails.installed == ["jupyter_server_ydoc"]


def test_to_page_config_is_json_safe_and_camelcase():
    sa = make_serverapp(
        extensions={"jupyter_server_ydoc": True, "jupyter_server_documents": True}
    )
    payload = rtc_lib.get_server_session_rtc_info(sa).to_page_config()
    # round-trips through JSON
    assert json.loads(json.dumps(payload)) == payload
    # camelCase contract, and traitConfig is gone
    assert set(payload) == {"enabled", "provider", "providerDetails"}
    assert set(payload["providerDetails"]) == {
        "installed",
        "enabledByServer",
        "enabledByTrait",
    }
    assert payload["provider"] == "jupyter_server_documents"
    assert payload["enabled"] is True


# --- publish_rtc_info --------------------------------------------------------


def test_publish_writes_page_config_under_expected_key():
    sa = make_serverapp(extensions={"jupyter_server_ydoc": True})
    info = rtc_lib.publish_rtc_info(sa)
    pc = sa.web_app.settings["page_config_data"]
    assert rtc_lib.PAGE_CONFIG_KEY == "serverSessionRtcInfo"
    assert pc["serverSessionRtcInfo"] == info.to_page_config()
    assert pc["serverSessionRtcInfo"]["provider"] == "jupyter_server_ydoc"


def test_publish_preserves_existing_page_config():
    sa = make_serverapp()
    sa.web_app.settings["page_config_data"] = {"existingKey": "keep-me"}
    rtc_lib.publish_rtc_info(sa)
    assert sa.web_app.settings["page_config_data"]["existingKey"] == "keep-me"
    assert "serverSessionRtcInfo" in sa.web_app.settings["page_config_data"]


# --- Defensive: malformed extension_manager must not crash -------------------


def test_missing_extension_apps_does_not_crash():
    sa = cast(
        "ServerApp",
        SimpleNamespace(
            extension_manager=SimpleNamespace(extensions={}, extension_apps=None),
            config={},
            web_app=SimpleNamespace(settings={}),
        ),
    )
    info = rtc_lib.get_server_session_rtc_info(sa)
    assert info.enabled is False and info.provider is None
