/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import type { IAwareness } from '@jupyter/ydoc';

type AutosaveAwareness = Pick<
  IAwareness,
  'getLocalState' | 'setLocalStateField'
>;

/**
 * Chat files should always advertise autosave=true so server-side RTC saving
 * remains enabled even when global autosave is disabled.
 */
export function enforceAutosaveEnabled(awareness: AutosaveAwareness): void {
  if (awareness.getLocalState()?.autosave !== true) {
    awareness.setLocalStateField('autosave', true);
  }
}
