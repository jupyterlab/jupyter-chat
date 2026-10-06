/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { isImeCompositionEvent } from '../components/input/ime';

describe('isImeCompositionEvent', () => {
  it('should return true while a composition session is active', () => {
    expect(isImeCompositionEvent({ isComposing: true, keyCode: 13 })).toBe(
      true
    );
  });

  it('should return true for the legacy keyCode 229 marker', () => {
    expect(isImeCompositionEvent({ isComposing: false, keyCode: 229 })).toBe(
      true
    );
  });

  it('should return false for a plain Enter key press', () => {
    expect(isImeCompositionEvent({ isComposing: false, keyCode: 13 })).toBe(
      false
    );
  });

  it('should return false for any other regular key press', () => {
    expect(isImeCompositionEvent({ isComposing: false, keyCode: 65 })).toBe(
      false
    );
  });
});
