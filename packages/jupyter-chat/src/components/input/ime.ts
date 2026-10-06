/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Returns true when a key event is part of an ongoing IME composition
 * (e.g. Chinese Pinyin, Japanese, or Korean input methods).
 *
 * Browsers set `isComposing` on key events emitted while a composition
 * session is active, and some engines report `keyCode === 229` instead.
 * Pressing Enter during composition confirms the current candidate; it
 * must not be treated as a regular Enter press (e.g. sending a message).
 */
export function isImeCompositionEvent(
  event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>
): boolean {
  return event.isComposing || event.keyCode === 229;
}
