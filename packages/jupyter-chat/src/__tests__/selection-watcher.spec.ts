/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { DocumentWidget } from '@jupyterlab/docregistry';
import { Signal } from '@lumino/signaling';

import { SelectionWatcher, selectionsEqual } from '../selection-watcher';
import { getEditor } from '../utils';

jest.mock('../utils', () => ({
  getEditor: jest.fn(),
  getCellIndex: jest.fn()
}));

const selection = (
  extra: Partial<SelectionWatcher.Selection> = {}
): SelectionWatcher.Selection => ({
  start: { line: 1, column: 0 },
  end: { line: 1, column: 5 },
  uuid: 'u',
  text: 'hello',
  numLines: 1,
  widgetId: 'w1',
  cellId: 'c1',
  ...extra
});

describe('selectionsEqual', () => {
  it('should compare by value: every poll builds new objects', () => {
    expect(selectionsEqual(selection(), selection())).toBe(true);
    expect(selectionsEqual(null, null)).toBe(true);
    expect(selectionsEqual(null, selection())).toBe(false);
  });

  it('should not be equal when only the position differs', () => {
    const moved = selection({ start: { line: 4, column: 2 } });
    expect(selectionsEqual(selection(), moved)).toBe(false);
  });
});

describe('SelectionWatcher', () => {
  beforeEach(() => {
    // The watcher polls on an interval that is never cleared.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should emit when the same text is selected at another place', async () => {
    const source = 'df = 1\ndf = 2';
    const editor = {
      selected: { start: { line: 0, column: 0 }, end: { line: 0, column: 2 } },
      getSelection: () => editor.selected,
      getOffsetAt: ({ line, column }: any) => (line ? 7 : 0) + column,
      model: {
        mimeType: 'text/x-python',
        sharedModel: { getSource: () => source }
      }
    };
    (getEditor as jest.Mock).mockReturnValue(editor);
    const widget = Object.defineProperties(
      Object.create(DocumentWidget.prototype),
      { id: { value: 'w1' }, isVisible: { value: true } }
    );
    const shell = { currentChanged: new Signal<any, any>({}) };
    const watcher = new SelectionWatcher({
      shell: shell as any,
      languages: { getLanguage: async () => null } as any
    });
    const changed = jest.fn();
    watcher.selectionChanged.connect(changed);
    shell.currentChanged.emit({ newValue: widget });
    const poll = () => (watcher as any)._poll();

    await poll();
    expect(changed).toHaveBeenCalledTimes(1);
    await poll();
    expect(changed).toHaveBeenCalledTimes(1);

    editor.selected = {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 2 }
    };
    await poll();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(watcher.selection).toMatchObject({ text: 'df', start: { line: 1 } });
  });
});
