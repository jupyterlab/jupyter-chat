# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""Awareness-backed pub/sub for the RTC (``YChat``) transport.

Presence topics map onto ``pycrdt`` awareness, whose native semantics already
match the pub/sub presence model: awareness is a map of client-id -> state dict,
and the value every peer observes for a key is the fold across all clients'
states. This module exposes that as the same raw-:class:`Payload` stream the
in-memory :class:`~jupyterlab_chat.pubsub.PubSubBus` produces, so a consumer's
:class:`~jupyterlab_chat.pubsub.MergeView` folds identically on both transports.

Each logical publisher (``client_id`` string) owns a distinct awareness slot.
``pycrdt.Awareness`` only exposes one local ``client_id`` per instance, so -- as
the persona-manager already does -- we temporarily swap ``awareness.client_id``
to write a given slot.
"""
from __future__ import annotations

import logging
import random
from contextlib import contextmanager
from itertools import count
from typing import Any, Callable, Dict, Iterator, Optional

from pycrdt import Awareness

from .pubsub import Payload, PubSubCallback, SubToken

_log = logging.getLogger(__name__)


class AwarenessBus:
    """Exposes awareness as a topic-based pub/sub bus of raw :class:`Payload`s.

    A topic is a field key within a client's awareness state; that field's value
    is that client's contribution to the topic. Subscribers receive one payload
    per contributing client (both on the initial snapshot and on every change),
    and a ``data=None`` payload when a client retracts a topic or disconnects.
    """

    def __init__(self, awareness: Awareness) -> None:
        self._aw = awareness
        self._orig_client_id = awareness.client_id
        # logical client_id -> awareness (int) client id, and the reverse map.
        self._slot_of: Dict[str, int] = {}
        self._logical_of: Dict[int, str] = {}
        self._subs: Dict[str, Dict[int, PubSubCallback]] = {}
        # topic -> contributor key -> last data delivered (for change detection).
        self._seen: Dict[str, Dict[str, Any]] = {}
        self._ids = count()
        self._aw_subscription: Optional[str] = None

    # ------------------------------------------------------------------
    # Publish
    # ------------------------------------------------------------------
    def pub(self, topic: str, data: Any, client_id: str = "server") -> None:
        slot = self._slot(client_id)
        with self._as_client(slot):
            state = dict(self._aw.get_local_state() or {})
            if data is None:
                state.pop(topic, None)
            else:
                state[topic] = data
            self._aw.set_local_state(state)

    def remove_client(self, client_id: str) -> None:
        """Drop a logical publisher's whole awareness slot (all its topics)."""
        slot = self._slot_of.get(client_id)
        if slot is None:
            return
        with self._as_client(slot):
            self._aw.set_local_state(None)

    # ------------------------------------------------------------------
    # Subscribe
    # ------------------------------------------------------------------
    def sub(self, topic: str, callback: PubSubCallback) -> SubToken:
        self._ensure_observer()
        sub_id = next(self._ids)
        self._subs.setdefault(topic, {})[sub_id] = callback
        # Snapshot: replay each client's current contribution to this topic.
        seen = self._seen.setdefault(topic, {})
        for cid, state in list(self._aw.states.items()):
            if topic in state:
                key = self._key(cid)
                seen[key] = state[topic]
                self._safe(callback, Payload(client_id=key, data=state[topic]))
        return SubToken(lambda: self._remove_sub(topic, sub_id))

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _slot(self, client_id: str) -> int:
        slot = self._slot_of.get(client_id)
        if slot is None:
            slot = random.getrandbits(32)
            self._slot_of[client_id] = slot
            self._logical_of[slot] = client_id
        return slot

    def _key(self, awareness_client_id: int) -> str:
        """Stable contributor key for a payload: the logical client_id for slots
        we own, otherwise the awareness client id as a string."""
        return self._logical_of.get(awareness_client_id, str(awareness_client_id))

    @contextmanager
    def _as_client(self, slot: int) -> Iterator[None]:
        self._aw.client_id = slot
        try:
            yield
        finally:
            self._aw.client_id = self._orig_client_id

    def _ensure_observer(self) -> None:
        if self._aw_subscription is None:
            self._aw_subscription = self._aw.observe(self._on_awareness)

    def _remove_sub(self, topic: str, sub_id: int) -> None:
        subs = self._subs.get(topic)
        if subs is not None:
            subs.pop(sub_id, None)
            if not subs:
                self._subs.pop(topic, None)

    def _on_awareness(self, action: str, change: Any) -> None:
        # Only react to genuine state changes, not the periodic "update" renewals
        # (which fire on the awareness heartbeat even when nothing changed).
        if action != "change":
            return
        changes, _origin = change
        states = self._aw.states
        touched = list(changes.get("added", [])) + list(changes.get("updated", []))
        removed = list(changes.get("removed", []))
        for topic, subs in list(self._subs.items()):
            if not subs:
                continue
            seen = self._seen.setdefault(topic, {})
            for cid in touched:
                key = self._key(cid)
                state = states.get(cid, {})
                if topic in state:
                    if seen.get(key) != state[topic]:
                        seen[key] = state[topic]
                        self._emit(topic, Payload(client_id=key, data=state[topic]))
                elif key in seen:
                    del seen[key]
                    self._emit(topic, Payload(client_id=key, data=None))
            for cid in removed:
                key = self._key(cid)
                if key in seen:
                    del seen[key]
                    self._emit(topic, Payload(client_id=key, data=None))

    def _emit(self, topic: str, payload: Payload) -> None:
        for callback in list(self._subs.get(topic, {}).values()):
            self._safe(callback, payload)

    @staticmethod
    def _safe(callback: PubSubCallback, payload: Payload) -> None:
        try:
            callback(payload)
        except Exception:  # pragma: no cover - defensive
            _log.exception("awareness pub/sub subscriber callback failed")
