/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Widget } from '@lumino/widgets';

import {
  SelectionAction,
  SelectionActionContext,
  SelectionActionRegistry
} from '../registers/selection-actions';
import {
  placeSelectionPopup,
  SelectionPopup
} from '../widgets/selection-popup';
import { PendingSnippet } from '../types';

const SNIPPET: PendingSnippet = {
  path: 'a.py',
  selection: { start: [0, 0], end: [0, 1], content: 'x' }
};

const RECT = { left: 100, top: 200, bottom: 220 };
const BOUNDS = { left: 0, top: 0, right: 800, bottom: 600 };

const makeContext = (
  extra: Partial<SelectionActionContext> = {}
): SelectionActionContext => ({
  ...SNIPPET,
  inputModel: null,
  chatModel: null,
  ...extra
});

const makeAction = (extra: Partial<SelectionAction> = {}): SelectionAction => ({
  id: 'a',
  label: 'Do it',
  run: jest.fn(),
  ...extra
});

describe('SelectionPopup', () => {
  let registry: SelectionActionRegistry;
  let popup: SelectionPopup;
  let beforeRun: jest.Mock;
  let reposition: jest.Mock;

  const create = (actions: SelectionAction[] = [makeAction()]) => {
    registry = new SelectionActionRegistry();
    actions.forEach(action => registry.addAction(action));
    popup = new SelectionPopup({ registry, beforeRun, reposition });
    Widget.attach(popup, document.body);
    return popup;
  };

  // Show the popup for a context, as the controller does.
  const show = (context: SelectionActionContext = makeContext()) => {
    popup.context = context;
    popup.placeAt(RECT, BOUNDS);
  };

  const keydown = (key: string) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key }));

  const pointerdown = (target: EventTarget) =>
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

  beforeEach(() => {
    beforeRun = jest.fn();
    reposition = jest.fn();
  });

  afterEach(() => {
    popup?.dispose();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should dismiss on Escape or an outside click, not on another key or an inside click', async () => {
    create();
    const reasons: string[] = [];
    popup.dismissed.connect((_, reason) => {
      reasons.push(reason);
    });
    const other = jest.fn();
    document.addEventListener('keydown', other);

    show();
    keydown('a');
    pointerdown(popup.node);
    expect(popup.isVisible).toBe(true);

    keydown('Escape');
    expect(popup.isHidden).toBe(true);
    // The key still reaches the other handlers, the completer's for one.
    expect(other).toHaveBeenCalledTimes(2);
    show();
    pointerdown(document.body);
    show();
    await (popup as any)._handleRun(registry.getActions()[0]);

    expect(reasons).toEqual(['escape', 'outside', 'run']);
    document.removeEventListener('keydown', other);
  });

  it('should place itself again on an interval while it has a context', () => {
    jest.useFakeTimers();
    create();
    show();
    jest.advanceTimersByTime(600);
    expect(reposition).toHaveBeenCalledTimes(2);

    popup.context = null;
    jest.advanceTimersByTime(600);
    expect(reposition).toHaveBeenCalledTimes(2);
  });

  it('should run with the context that beforeRun returns', async () => {
    const run = jest.fn();
    const context = makeContext();
    const resolved = makeContext({ path: 'b.py' });
    beforeRun.mockReturnValue(resolved);
    create([makeAction({ run })]);
    show(context);

    await (popup as any)._handleRun(registry.getActions()[0]);

    expect(beforeRun).toHaveBeenCalledWith(registry.getActions()[0], context);
    expect(run.mock.calls).toEqual([[resolved]]);
    expect(popup.isHidden).toBe(true);
  });
});

describe('placeSelectionPopup', () => {
  it('should place above the end of the selection', () => {
    expect(
      placeSelectionPopup(RECT, BOUNDS, { width: 120, height: 32 })
    ).toEqual({ left: 100, top: 160 });
  });
});
