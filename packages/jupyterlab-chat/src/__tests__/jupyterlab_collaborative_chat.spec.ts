/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { enforceAutosaveEnabled } from '../autosave';

describe('enforceAutosaveEnabled', () => {
  it('should set autosave to true when it is missing', () => {
    const state: Record<string, unknown> = {};
    const awareness = {
      getLocalState: () => state,
      setLocalStateField: (field: string, value: unknown) => {
        state[field] = value;
      }
    };

    enforceAutosaveEnabled(awareness);
    expect(state.autosave).toBe(true);
  });

  it('should set autosave to true when it is false', () => {
    const state: Record<string, unknown> = { autosave: false };
    const awareness = {
      getLocalState: () => state,
      setLocalStateField: (field: string, value: unknown) => {
        state[field] = value;
      }
    };

    enforceAutosaveEnabled(awareness);
    expect(state.autosave).toBe(true);
  });

  it('should keep autosave true when already enabled', () => {
    const state: Record<string, unknown> = { autosave: true };
    let called = false;
    const awareness = {
      getLocalState: () => state,
      setLocalStateField: () => {
        called = true;
      }
    };

    enforceAutosaveEnabled(awareness);
    expect(called).toBe(false);
  });
});
