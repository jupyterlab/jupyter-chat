# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
"""A generic pub/sub bus for Jupyter Chat.

This is the transport-agnostic core of the pub/sub API described in
``docs/design/pubsub-api.md``. Consumers ``pub``/``sub``/``unsub`` to named
topics; the bus relays raw :class:`Payload`s to the subscribers of a topic and
retains the latest contribution per publisher so a late subscriber can catch up.

The bus deliberately does **not** merge payloads. Merging is a per-peer concern
(see :class:`MergeView`), because it must work identically whether the transport
is the YDoc/awareness (RTC) or this in-memory bus (RTC-free).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from itertools import count
from typing import Any, Callable, Dict, Optional, Set

_log = logging.getLogger(__name__)


@dataclass
class Payload:
    """A single pub/sub message.

    ``client_id`` identifies the publisher. It is what lets a subscriber
    attribute keys to a contributor (for replicated sets such as the writers
    list) and drop them when that contributor goes away.
    """

    client_id: str
    data: Any


#: A subscriber callback, invoked with each :class:`Payload` on its topic.
PubSubCallback = Callable[[Payload], None]


class SubToken:
    """Opaque handle returned by :meth:`PubSubBus.sub`.

    Pass it to :meth:`PubSubBus.unsub` (or call the model's ``unsub``) to stop
    receiving updates and release the underlying subscription.
    """

    def __init__(self, teardown: Callable[[], None]) -> None:
        self._teardown = teardown
        self._active = True

    def _release(self) -> None:
        if self._active:
            self._active = False
            self._teardown()


class PubSubBus:
    """An in-memory relay of :class:`Payload`s, grouped by topic.

    Responsibilities:
      * fan a published payload out to the topic's current subscribers,
      * retain the latest payload per publisher so a new subscriber can be
        seeded (the "catchup" snapshot),
      * relay a clearing payload (``data=None``) when a publisher retracts its
        contribution or disconnects.
    """

    def __init__(self) -> None:
        self._subs: Dict[str, Dict[int, PubSubCallback]] = {}
        self._retained: Dict[str, Dict[str, Any]] = {}
        self._ids = count()

    def pub(self, topic: str, data: Any, client_id: str = "server") -> None:
        """Publish ``data`` to ``topic`` on behalf of ``client_id``.

        ``data=None`` retracts this publisher's contribution to the topic.
        """
        retained = self._retained.setdefault(topic, {})
        if data is None:
            retained.pop(client_id, None)
        else:
            retained[client_id] = data
        self._emit(topic, Payload(client_id=client_id, data=data))

    def sub(self, topic: str, callback: PubSubCallback) -> SubToken:
        """Subscribe ``callback`` to ``topic`` and immediately replay the
        current retained payloads to it (and only it)."""
        sub_id = next(self._ids)
        self._subs.setdefault(topic, {})[sub_id] = callback
        for client_id, data in list(self._retained.get(topic, {}).items()):
            self._safe(callback, Payload(client_id=client_id, data=data))
        return SubToken(lambda: self._remove(topic, sub_id))

    def unsub(self, token: SubToken) -> None:
        """Stop a subscription created by :meth:`sub`."""
        token._release()

    def remove_client(self, client_id: str) -> None:
        """Drop everything ``client_id`` published, relaying a clearing payload
        on each affected topic. Called when a connection closes."""
        for topic, retained in list(self._retained.items()):
            if client_id in retained:
                retained.pop(client_id, None)
                self._emit(topic, Payload(client_id=client_id, data=None))

    def _remove(self, topic: str, sub_id: int) -> None:
        subs = self._subs.get(topic)
        if subs is not None:
            subs.pop(sub_id, None)
            if not subs:
                self._subs.pop(topic, None)

    def _emit(self, topic: str, payload: Payload) -> None:
        for callback in list(self._subs.get(topic, {}).values()):
            self._safe(callback, payload)

    @staticmethod
    def _safe(callback: PubSubCallback, payload: Payload) -> None:
        try:
            callback(payload)
        except Exception:  # pragma: no cover - defensive
            _log.exception("pub/sub subscriber callback failed")


class MergeView:
    """Folds a stream of :class:`Payload`s into a topic's current value.

    The rule, applied per peer:

    * a **dict** payload is merged by top-level key (a key mapped to ``None``
      deletes it) -- this is a replicated set/dictionary,
    * any **other** value replaces the whole value (last writer wins),
    * a payload whose ``data`` is ``None`` drops that publisher's contribution.
    """

    def __init__(self) -> None:
        self._value: Any = None
        self._keys_by_client: Dict[str, Set[str]] = {}
        self._replaced_by: Optional[str] = None

    @property
    def value(self) -> Any:
        return self._value

    def apply(self, payload: Payload) -> None:
        client_id, data = payload.client_id, payload.data
        if data is None:
            self._drop_client(client_id)
        elif isinstance(data, dict):
            self._merge(client_id, data)
        else:
            self._value = data
            self._replaced_by = client_id
            self._keys_by_client.clear()

    def _merge(self, client_id: str, data: Dict[str, Any]) -> None:
        if not isinstance(self._value, dict):
            self._value = {}
            self._replaced_by = None
        owned = self._keys_by_client.setdefault(client_id, set())
        for key, val in data.items():
            if val is None:
                self._value.pop(key, None)
                owned.discard(key)
            else:
                self._value[key] = val
                owned.add(key)

    def _drop_client(self, client_id: str) -> None:
        owned = self._keys_by_client.pop(client_id, set())
        if isinstance(self._value, dict):
            for key in owned:
                self._value.pop(key, None)
        elif self._replaced_by == client_id:
            self._value = None
            self._replaced_by = None
