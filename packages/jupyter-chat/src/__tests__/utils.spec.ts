/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { selectionFromOffsets } from '../utils';

// Converts an offset in `text` to a position.
const positionAt = (text: string) => (offset: number) => {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length - 1, column: lines[lines.length - 1].length };
};

describe('selectionFromOffsets', () => {
  // The end of the range is inclusive.
  it('should convert a range across lines', () => {
    expect(selectionFromOffsets(positionAt('ab\ncd'), 1, 4, 'b\nc')).toEqual({
      start: [0, 1],
      end: [1, 0],
      content: 'b\nc'
    });
  });
});
