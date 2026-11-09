/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IChatPanel,
  SelectionAction,
  SelectionActionContext,
  SelectionWatcher
} from '@jupyter/chat';
import { Signal } from '@lumino/signaling';

import { SelectionPopupController } from '../selection-popup-controller';

const SOURCE = 'print(1)\nprint(2)\nprint(3)';

type Position = { line: number; column: number };

/**
 * An editor over a text, with the methods the controller calls.
 */
class FakeEditor {
  constructor(public source: string) {}

  selected = { start: 0, end: 0 };

  // The coordinates depend on the position: a test can tell which one is asked.
  getCoordinateForPosition({ line, column }: Position) {
    return {
      left: 100 + column,
      top: 200 + 20 * line,
      bottom: 220 + 20 * line
    };
  }

  select(start: number, end: number): void {
    this.selected = { start, end };
  }

  getOffsetAt({ line, column }: Position): number {
    const before = this.source.split('\n').slice(0, line).join('\n').length;
    return line === 0 ? column : before + 1 + column;
  }

  getPositionAt(offset: number): Position {
    const lines = this.source.slice(0, offset).split('\n');
    return { line: lines.length - 1, column: lines[lines.length - 1].length };
  }

  getSelection() {
    return {
      start: this.getPositionAt(this.selected.start),
      end: this.getPositionAt(this.selected.end)
    };
  }

  get model() {
    return { sharedModel: { getSource: () => this.source } };
  }
}

function makeWidget(editor: FakeEditor, extra: object = {}) {
  const node = document.createElement('div');
  document.body.appendChild(node);
  const scroller = document.createElement('div');
  scroller.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600 }) as DOMRect;
  return {
    id: 'w1',
    node,
    context: { path: 'a.py' },
    content: { node: scroller, ...extra },
    editor
  };
}

class FakePopup {
  context: SelectionActionContext | null = null;
  placeAt = jest.fn();
  dismissed = new Signal<unknown, 'escape' | 'outside' | 'run'>(this);
}

class FakeWatcher {
  selection: SelectionWatcher.Selection | null = null;
  selectionChanged = new Signal<unknown, SelectionWatcher.Selection | null>(
    this
  );
  select(selection: SelectionWatcher.Selection | null): void {
    this.selection = selection;
    this.selectionChanged.emit(selection);
  }
}

function selectionOf(
  editor: FakeEditor,
  start: number,
  end: number,
  extra: Partial<SelectionWatcher.Selection> = {}
): SelectionWatcher.Selection {
  const text = editor.source.slice(start, end);
  return {
    start: editor.getPositionAt(start),
    end: editor.getPositionAt(end),
    uuid: 'u',
    text,
    numLines: text.split('\n').length,
    widgetId: 'w1',
    ...extra
  };
}

const makeDestination = (visible = true) =>
  ({
    model: { input: { addPendingSnippet: jest.fn() } },
    isVisible: visible,
    id: 'chat'
  }) as unknown as IChatPanel;

const action = (): SelectionAction => ({
  id: 'a',
  label: 'A',
  run: jest.fn()
});

const fire = (target: EventTarget, type: string) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true }));

describe('SelectionPopupController', () => {
  let editor: FakeEditor;
  let widget: ReturnType<typeof makeWidget>;
  let watcher: FakeWatcher;
  let popup: FakePopup;
  let destination: IChatPanel | null;
  let reveal: jest.Mock;
  let enabled: boolean;
  let controller: SelectionPopupController;

  const options = (): SelectionPopupController.IOptions => ({
    document,
    watcher: watcher as any,
    popup: popup as any,
    // The editor of the active cell for a notebook, as `getEditor` gives.
    getEditor: w =>
      w === (widget as any)
        ? ((widget.content as any).activeCell?.editor ?? editor)
        : null,
    getWidget: id => (id === 'w1' ? (widget as any) : null),
    resolveDestination: () => destination,
    reveal,
    isEnabled: () => enabled
  });

  // How many times the popup was placed for a context.
  const shown = () => popup.placeAt.mock.calls.length;

  beforeEach(() => {
    jest.useFakeTimers();
    editor = new FakeEditor(SOURCE);
    widget = makeWidget(editor);
    watcher = new FakeWatcher();
    popup = new FakePopup();
    destination = makeDestination();
    reveal = jest.fn();
    enabled = true;
    controller = new SelectionPopupController(options());
    controller.update();
  });

  afterEach(() => {
    controller.dispose();
    widget.node.remove();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('showing', () => {
    it('should show for a selection change when no button is pressed', () => {
      watcher.select(selectionOf(editor, 0, 8));
      expect(shown()).toBe(1);
      expect(popup.context).toMatchObject({
        path: 'a.py',
        inputModel: (destination as any).model.input,
        chatModel: (destination as any).model,
        selection: { start: [0, 0], end: [0, 7], content: 'print(1)' }
      });
      expect(popup.placeAt).toHaveBeenCalledWith(
        { left: 108, top: 200, bottom: 220 },
        { left: 0, top: 0, right: 800, bottom: 600 }
      );
    });

    it('should hide on a pointer up that collapsed the selection', () => {
      watcher.select(selectionOf(editor, 0, 8));
      // The click collapsed the selection; the watcher has not polled yet.
      fire(widget.node, 'pointerdown');
      editor.select(3, 3);
      fire(widget.node, 'pointerup');
      expect(popup.context).toBeNull();
      expect(shown()).toBe(1);
    });

    it('should read the cell of the selection, not the active one', () => {
      const other = new FakeEditor('other\ncode');
      widget.node.remove();
      widget = makeWidget(editor, {
        activeCell: { model: { id: 'c2' }, editor: other },
        widgets: [
          { model: { id: 'c1' }, editor },
          { model: { id: 'c2' }, editor: other }
        ]
      });
      watcher.select(selectionOf(editor, 0, 8, { cellId: 'c1' }));
      expect(popup.context?.cellId).toBe('c1');
      expect(popup.context?.selection.content).toBe('print(1)');
    });
  });

  describe('dismissal', () => {
    it.each(['escape', 'outside', 'run'] as const)(
      'should stay dismissed for the same selection after %s',
      reason => {
        watcher.select(selectionOf(editor, 0, 8));
        popup.dismissed.emit(reason);
        expect(popup.context).toBeNull();

        // Not on a reposition, nor on a click in the document or outside it.
        editor.select(0, 8);
        controller.reposition();
        jest.advanceTimersByTime(20);
        for (const target of [widget.node, document.body]) {
          fire(target, 'pointerdown');
          fire(target, 'pointerup');
        }
        expect(shown()).toBe(1);

        // Another selection is shown.
        watcher.select(selectionOf(editor, 9, 17));
        expect(shown()).toBe(2);
      }
    );
  });

  describe('setting', () => {
    it('should listen to nothing while off, attach when turned on and detach when turned off', () => {
      controller.dispose();
      enabled = false;
      controller = new SelectionPopupController(options());
      controller.update();
      watcher.select(selectionOf(editor, 0, 8));
      editor.select(0, 8);
      fire(widget.node, 'pointerdown');
      fire(widget.node, 'pointerup');
      expect(shown()).toBe(0);

      // It shows the selection the watcher already holds.
      enabled = true;
      controller.update();
      expect(shown()).toBe(1);

      enabled = false;
      controller.update();
      expect(popup.context).toBeNull();
      fire(widget.node, 'pointerdown');
      fire(widget.node, 'pointerup');
      watcher.select(selectionOf(editor, 9, 17));
      expect(shown()).toBe(1);
    });
  });

  describe('beforeRun', () => {
    beforeEach(() => {
      watcher.select(selectionOf(editor, 0, 8));
    });

    it('should build the context from the current editor selection, made backwards or not', () => {
      // The watcher holds print(1); the user selected print(2) since.
      editor.select(17, 9);
      expect(controller.beforeRun(action())).toMatchObject({
        path: 'a.py',
        selection: { start: [1, 0], end: [1, 7], content: 'print(2)' },
        inputModel: (destination as any).model.input,
        chatModel: (destination as any).model
      });
      expect(popup.context).toBeNull();
    });

    it('should hand the way to open a chat to the action only while there is none', () => {
      const openNewChat = jest.fn();
      controller.dispose();
      controller = new SelectionPopupController({ ...options(), openNewChat });
      controller.update();
      editor.select(0, 8);
      expect(controller.beforeRun(action())?.openNewChat).toBeUndefined();

      // The popup shows the action from `context()`, the click runs it with
      // what `beforeRun()` returns: both have to carry it.
      destination = null;
      expect(controller.context()?.context.openNewChat).toBe(openNewChat);
      expect(controller.beforeRun(action())).toMatchObject({
        inputModel: null,
        chatModel: null,
        openNewChat
      });
    });

    it.each<[boolean, number]>([
      [false, 1],
      [true, 0]
    ])(
      'should reveal the destination (visible: %s) %s times',
      (visible, times) => {
        destination = makeDestination(visible);
        editor.select(0, 8);
        controller.beforeRun(action());
        expect(reveal).toHaveBeenCalledTimes(times);
      }
    );
  });
});
