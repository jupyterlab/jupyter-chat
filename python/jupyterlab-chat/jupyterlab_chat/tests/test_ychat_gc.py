# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import gc
import weakref

# Import jupyter_ydoc first to avoid a circular import via its entry points.
import jupyter_ydoc  # noqa: F401

from ..ychat import YChat


def test_ychat_collected_after_unobserve():
    """YChat must be garbage-collected after unobserve().

    Observers registered in __init__ are bound methods that capture ``self``.
    If unobserve() does not remove them, the YChat is never collected (leak).
    """
    ychat = YChat()
    ychat.unobserve()

    ref = weakref.ref(ychat)
    del ychat
    for _ in range(3):
        gc.collect()

    assert ref() is None, "YChat leaked after unobserve() (observers not removed)"


def test_ychat_collected_after_observe_then_unobserve():
    """YChat must be collectable after the realistic observe()/unobserve() flow.

    A server registers a sync callback via ``observe()`` and later tears the
    document down with ``unobserve()``. Both the ``observe()`` subscriptions and
    the ``__init__`` observers must be removed for the YChat to be collected.
    """
    ychat = YChat()
    ychat.observe(lambda *args: None)
    ychat.unobserve()

    ref = weakref.ref(ychat)
    del ychat
    for _ in range(3):
        gc.collect()

    assert ref() is None, "YChat leaked after observe() then unobserve()"


def test_ychat_collected_after_unobserve_while_dirty():
    """YChat must be collectable even if torn down before any state event fires.

    When the document is still dirty, ``_initialize`` has not yet removed the
    state subscription, so ``unobserve()`` must remove it defensively.
    """
    ychat = YChat()
    assert ychat.dirty is True
    ychat.unobserve()

    ref = weakref.ref(ychat)
    del ychat
    for _ in range(3):
        gc.collect()

    assert ref() is None, "YChat leaked after unobserve() while dirty"
