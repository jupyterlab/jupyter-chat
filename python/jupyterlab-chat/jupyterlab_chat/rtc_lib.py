# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""RTC provider detection for jupyterlab_chat.

This module answers one question for the current server session: is a real-time
collaboration (RTC) provider active, and if so, which one? ``jupyterlab_chat``
switches transport based on the answer -- the collaborative ``YChat`` model when
a provider is present, and the plain-WebSocket ``WsChatModel`` otherwise -- and
advertises the decision to the frontend via ``PageConfig``.

Design notes
------------
* We never ``import`` an RTC provider or touch its internals. We only inspect
  the ``ServerApp`` to learn which server extensions are *installed*, which are
  *enabled* for this session, and -- for ``jupyter_server_ydoc`` -- whether RTC
  was turned off via the ``YDocExtension.disable_rtc`` trait.
* A provider is only *active* when it is enabled on two independent axes:
  ``enabledByServer`` (the server extension is enabled) AND ``enabledByTrait``
  (no trait disables it). ``jupyter_server_documents`` (JSD) has no disabling
  trait, so it is always trait-enabled; ``jupyter_server_ydoc`` (JSY) is
  trait-enabled unless ``disable_rtc`` is set.
* "Installed" (importable) is not the same as "enabled". An admin may ship an
  image with an RTC provider installed but disabled via
  ``jupyter server extension disable ...`` or the ``disable_rtc`` trait, and we
  must honor that: RTC stays off.
"""
from __future__ import annotations

import importlib.util
from dataclasses import asdict, dataclass, field
from typing import TYPE_CHECKING, Literal, Optional

if TYPE_CHECKING:
    from jupyter_server.serverapp import ServerApp

# --- RTC providers -----------------------------------------------------------

RTCProvider = Literal["jupyter_server_documents", "jupyter_server_ydoc"]
"""A backend server extension that supplies the shared-document (YCRDT)
transport the collaborative chat relies on. We only need their *names*."""

RTC_PROVIDERS: set[RTCProvider] = {
    "jupyter_server_documents",
    "jupyter_server_ydoc",
}

# The traitlets application (class) name under which jupyter_server_ydoc's
# ``disable_rtc`` trait is addressed on ``ServerApp.config`` (used only as a
# fallback when the live extension app is not available).
_YDOC_APP_NAME = "YDocExtension"


# --- Low-level probes --------------------------------------------------------


def _is_installed(name: str) -> bool:
    """True iff module ``name`` is importable (installed in this environment)."""
    return importlib.util.find_spec(name) is not None


def _is_enabled(serverapp: "ServerApp", name: str) -> bool:
    """True iff ``name`` is a server extension *configured AND enabled* for THIS
    session.

    Authoritative, unlike ``import name``: returns False when the package is
    installed but disabled via ``jupyter server extension disable <name>``.
    Enablement is resolved from merged ``jpserver_extensions`` config before any
    extension loads, so this is safe to call from an extension's
    ``_load_jupyter_server_extension``.
    """
    ext = serverapp.extension_manager.extensions.get(name)
    return bool(ext and ext.enabled)


def _provider_app(serverapp: "ServerApp", name: RTCProvider):
    """The live ``ExtensionApp`` instance for a provider, or ``None``.

    Both RTC providers sort alphabetically before ``jupyterlab_chat``, so when a
    provider is enabled its app is already instantiated by the time we run.
    Never raises.
    """
    try:
        apps = getattr(serverapp.extension_manager, "extension_apps", None) or {}
        instances = apps.get(name)
        return next(iter(instances)) if instances else None
    except Exception:  # pragma: no cover - defensive; never break startup
        return None


def _coerce_bool(value: object) -> bool:
    """Coerce a config value to bool.

    Necessary because CLI-set extension traits arrive in ``serverapp.config`` as
    ``DeferredConfigString`` (a ``str`` subclass) BEFORE the owning class coerces
    them, e.g. ``--YDocExtension.disable_rtc=False`` stores
    ``DeferredConfigString('False')``. A naive ``bool(...)`` on that returns True
    (non-empty string), which would wrongly report RTC as disabled.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):  # includes DeferredConfigString
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def is_rtc_disabled_by_trait(serverapp: "ServerApp") -> bool:
    """True iff ``YDocExtension.disable_rtc`` is set for this session.

    Prefers the live ``jupyter_server_ydoc`` extension app, whose ``disable_rtc``
    is a properly coerced ``bool``. Falls back to the merged traitlets config
    (CLI flags, config files, env) with careful coercion when no instance exists
    (in which case JSY is not an active provider anyway). The traitlets default
    is ``False`` (RTC stays on). This only governs ``jupyter_server_ydoc``;
    ``jupyter_server_documents`` has no such trait.
    """
    app = _provider_app(serverapp, "jupyter_server_ydoc")
    if app is not None:
        return bool(getattr(app, "disable_rtc", False))
    ydoc_cfg = serverapp.config.get(_YDOC_APP_NAME, {})
    return _coerce_bool(ydoc_cfg.get("disable_rtc", False))


def _enabled_by_server(serverapp: "ServerApp") -> set[RTCProvider]:
    """RTC providers whose server extension is enabled this session."""
    return {name for name in RTC_PROVIDERS if _is_enabled(serverapp, name)}


def _enabled_by_trait(serverapp: "ServerApp") -> set[RTCProvider]:
    """RTC providers that are not turned off by a trait this session.

    JSD has no disabling trait, so it is always here. JSY is here unless
    ``disable_rtc`` is set.
    """
    result: set[RTCProvider] = {"jupyter_server_documents"}
    if not is_rtc_disabled_by_trait(serverapp):
        result.add("jupyter_server_ydoc")
    return result


# --- Resolution --------------------------------------------------------------


def get_rtc_provider(serverapp: "ServerApp") -> Optional[RTCProvider]:
    """Name of the active RTC provider for this session, or ``None`` if RTC is off.

    A provider is active only when it is enabled on *both* axes: its server
    extension is enabled AND no trait disables it. If both providers are active,
    ``jupyter_server_documents`` (JSD) wins. (In practice JSD ships config that
    disables JSY, so both-active only happens if an admin re-enables JSY.)

    Asks the server which extensions are enabled; knows nothing about how any
    provider actually works.
    """
    active = _enabled_by_server(serverapp) & _enabled_by_trait(serverapp)
    if "jupyter_server_documents" in active:
        return "jupyter_server_documents"
    if "jupyter_server_ydoc" in active:
        return "jupyter_server_ydoc"
    return None


# --- Session info dataclass + PageConfig publishing --------------------------
#
# NOTE: field names are intentionally camelCase (non-PEP8). This dataclass is
# serialized verbatim into PageConfig and read by the frontend, so keeping the
# Python field names identical to the JSON keys avoids a mapping layer.


@dataclass(kw_only=True)
class RtcProviderDetails:
    """Diagnostic detail about RTC providers in this session."""

    installed: list[str] = field(default_factory=list)
    """RTC provider extensions that are importable (installed), enabled or not."""

    enabledByServer: list[str] = field(default_factory=list)
    """RTC providers whose *server extension* is enabled this session."""

    enabledByTrait: list[str] = field(default_factory=list)
    """RTC providers not turned off by a trait. Always includes
    ``jupyter_server_documents`` (no disabling trait); includes
    ``jupyter_server_ydoc`` unless ``disable_rtc`` is set. A provider is active
    only when it appears in BOTH ``enabledByServer`` and ``enabledByTrait``."""


@dataclass(kw_only=True)
class ServerSessionRtcInfo:
    """Resolved RTC state for the current server session.

    Serialized to ``PageConfig`` so frontend plugins can gate themselves without
    a handshake.
    """

    enabled: bool
    """Whether an RTC provider is actually active this session (i.e.
    ``provider is not None``). False when JSY is enabled but ``disable_rtc`` is
    set."""

    provider: Optional[RTCProvider]
    """Which RTC backend is active (informational), or ``None``."""

    providerDetails: RtcProviderDetails

    def to_page_config(self) -> dict:
        """Emit the JSON shape the frontend reads from PageConfig.

        Field names already match the frontend contract (camelCase), so this is
        a straight ``asdict``.
        """
        return asdict(self)


def get_server_session_rtc_info(serverapp: "ServerApp") -> ServerSessionRtcInfo:
    """Build the :class:`ServerSessionRtcInfo` for this session."""
    by_server = _enabled_by_server(serverapp)
    by_trait = _enabled_by_trait(serverapp)
    active = by_server & by_trait

    if "jupyter_server_documents" in active:
        provider: Optional[RTCProvider] = "jupyter_server_documents"
    elif "jupyter_server_ydoc" in active:
        provider = "jupyter_server_ydoc"
    else:
        provider = None

    installed = sorted(name for name in RTC_PROVIDERS if _is_installed(name))

    return ServerSessionRtcInfo(
        enabled=provider is not None,
        provider=provider,
        providerDetails=RtcProviderDetails(
            installed=installed,
            enabledByServer=sorted(by_server),
            enabledByTrait=sorted(by_trait),
        ),
    )


#: The ``PageConfig`` key under which the session RTC info is advertised.
PAGE_CONFIG_KEY = "serverSessionRtcInfo"


def publish_rtc_info(serverapp: "ServerApp") -> ServerSessionRtcInfo:
    """Compute the session RTC info and write it into ``page_config_data``.

    Returns the computed info so the caller can also use it to decide which
    handlers/models to wire up.
    """
    info = get_server_session_rtc_info(serverapp)
    page_config = serverapp.web_app.settings.setdefault("page_config_data", {})
    page_config[PAGE_CONFIG_KEY] = info.to_page_config()
    return info
