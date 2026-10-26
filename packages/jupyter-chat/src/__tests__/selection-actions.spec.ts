/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Notification } from '@jupyterlab/apputils';
import { nullTranslator } from '@jupyterlab/translation';

import { IInputModel, MAX_SNIPPET_LENGTH } from '../input-model';
import {
  SelectionAction,
  SelectionActionContext,
  SelectionActionRegistry
} from '../registers/selection-actions';
import { PendingSnippet } from '../types';

const SNIPPET: PendingSnippet = {
  path: 'a.py',
  cellId: 'c1',
  selection: { start: [0, 0], end: [0, 2], content: 'x=' }
};

const makeAction = (id: string): SelectionAction => ({
  id,
  label: id,
  run: jest.fn()
});

describe('SelectionActionRegistry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should warn on a duplicate id, keep the first action and not emit', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new SelectionActionRegistry();
    const changed = jest.fn();
    registry.itemsChanged.connect(changed);
    const first = makeAction('same');
    registry.addAction(first);
    registry.addAction(makeAction('same'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(registry.getActions()).toEqual([first]);
  });
});

describe('default registry', () => {
  const [action] = SelectionActionRegistry.defaultRegistry(
    nullTranslator.load('jupyterlab')
  ).getActions();

  const context = (
    input: Partial<IInputModel> | null,
    extra: Partial<SelectionActionContext> = {}
  ): SelectionActionContext => ({
    ...SNIPPET,
    inputModel: input as IInputModel | null,
    chatModel: null,
    ...extra
  });

  it('should stage the snippet fields only, and focus the input', async () => {
    const addPendingSnippet = jest.fn().mockReturnValue(true);
    const focus = jest.fn();
    await action.run(
      context({ addPendingSnippet, focus }, { chatModel: {} as any })
    );
    // Equal to the snippet: the chat model of the context is not staged.
    expect(addPendingSnippet).toHaveBeenCalledWith(SNIPPET);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('should be enabled with no chat only if a chat can be opened', () => {
    const openNewChat = jest.fn();
    expect(action.isEnabled!(context(null))).toBe(false);
    expect(action.isEnabled!(context(null, { openNewChat }))).toBe(true);
    expect(openNewChat).not.toHaveBeenCalled();
  });

  it('should open a chat when there is none, and stage the snippet in it', async () => {
    const addPendingSnippet = jest.fn().mockReturnValue(true);
    const focus = jest.fn();
    const openNewChat = jest.fn().mockResolvedValue({
      input: { addPendingSnippet, focus }
    });
    await action.run(context(null, { openNewChat }));
    expect(openNewChat).toHaveBeenCalledTimes(1);
    expect(addPendingSnippet).toHaveBeenCalledWith(SNIPPET);
    expect(focus).toHaveBeenCalledTimes(1);

    // A chat that cannot be opened: nothing is staged and nothing throws.
    await action.run(
      context(null, { openNewChat: jest.fn().mockResolvedValue(null) })
    );
    expect(addPendingSnippet).toHaveBeenCalledTimes(1);
  });

  it('should not open a chat for a selection over the limit', async () => {
    const warning = jest.spyOn(Notification, 'warning').mockReturnValue('id');
    const openNewChat = jest.fn();
    await action.run({
      ...context(null, { openNewChat }),
      selection: {
        ...SNIPPET.selection,
        content: 'x'.repeat(MAX_SNIPPET_LENGTH + 1)
      }
    });
    expect(warning).toHaveBeenCalledTimes(1);
    expect(openNewChat).not.toHaveBeenCalled();
    warning.mockRestore();
  });
});
