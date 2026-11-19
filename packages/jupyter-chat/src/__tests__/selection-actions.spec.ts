/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Notification } from '@jupyterlab/apputils';
import { nullTranslator } from '@jupyterlab/translation';

import { IInputModel } from '../input-model';
import {
  SelectionAction,
  SelectionActionContext,
  SelectionActionRegistry
} from '../registers/selection-actions';

const SOURCE = {
  path: 'a.ipynb',
  cellId: 'c1',
  cellType: 'code' as const,
  selection: {
    start: [0, 0] as [number, number],
    end: [0, 2] as [number, number],
    content: 'x='
  }
};

const BLOCK = 'From ` a.ipynb ` (cell ` c1 `) lines 1-1:\n```\nx=\n```\n';

/**
 * A minimal input: a value, a cursor index, focus and attachments.
 */
const makeInput = (
  value = ''
): Partial<IInputModel> & {
  value: string;
  cursorIndex: number | null;
  focus: jest.Mock;
  addAttachment: jest.Mock;
} => ({
  value,
  cursorIndex: null,
  isDisposed: false,
  focus: jest.fn(),
  addAttachment: jest.fn()
});

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
    ...SOURCE,
    inputModel: input as IInputModel | null,
    chatModel: null,
    ...extra
  });

  const withContent = (content: string): Partial<SelectionActionContext> => ({
    selection: { ...SOURCE.selection, content }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should insert the header and the fenced block, with the caret at the end', async () => {
    const input = makeInput();
    await action.run(context(input));
    expect(input.value).toBe(BLOCK);
    expect(input.cursorIndex).toBe(BLOCK.length);
    expect(input.focus).toHaveBeenCalledTimes(1);
    expect(input.addAttachment).not.toHaveBeenCalled();
  });

  it('should append after a draft, separated by a blank line', async () => {
    const input = makeInput('Explain this  \n');
    await action.run(context(input));
    expect(input.value).toBe(`Explain this\n\n${BLOCK}`);
    // A second selection stacks the same way.
    await action.run(context(input));
    expect(input.value).toBe(`Explain this\n\n${BLOCK}\n${BLOCK}`);
  });

  it('should use a fence longer than any backtick run in the selection', async () => {
    const input = makeInput();
    await action.run(context(input, withContent('a ``` b\n')));
    expect(input.value).toBe(
      'From ` a.ipynb ` (cell ` c1 `) lines 1-1:\n````\na ``` b\n````\n'
    );
  });

  it('should insert mentions and commands of the selection verbatim', async () => {
    // The text is sent as typed text: command providers act on it at send.
    const input = makeInput();
    await action.run(context(input, withContent('@alice @file:x.py /clear')));
    expect(input.value).toContain('\n@alice @file:x.py /clear\n');
    expect(input.value.startsWith('From ')).toBe(true);
  });

  it('should insert in an input that cannot take attachments', async () => {
    const input = makeInput();
    delete (input as Partial<IInputModel>).addAttachment;
    await action.run(context(input));
    expect(input.value).toBe(BLOCK);
  });

  it('should be enabled with an input, or with no chat if one can be opened', () => {
    const openNewChat = jest.fn();
    expect(action.isEnabled!(context(makeInput()))).toBe(true);
    expect(action.isEnabled!(context(null))).toBe(false);
    expect(action.isEnabled!(context(null, { openNewChat }))).toBe(true);
    expect(openNewChat).not.toHaveBeenCalled();
  });

  it('should open a chat when there is none, and insert in it', async () => {
    const input = makeInput();
    const openNewChat = jest.fn().mockResolvedValue({ input });
    await action.run(context(null, { openNewChat }));
    expect(openNewChat).toHaveBeenCalledTimes(1);
    expect(input.value).toBe(BLOCK);

    // A chat that cannot be opened: nothing throws.
    await expect(
      action.run(
        context(null, { openNewChat: jest.fn().mockResolvedValue(null) })
      )
    ).resolves.toBeUndefined();
  });

  it('should attach the notebook cell over the inserted limit', async () => {
    const info = jest.spyOn(Notification, 'info').mockReturnValue('id');
    const input = makeInput('draft');
    const content = 'x'.repeat(20_001);
    await action.run(context(input, withContent(content)));
    expect(input.value).toBe('draft');
    expect(input.addAttachment).toHaveBeenCalledTimes(1);
    expect(input.addAttachment.mock.calls[0][0]).toStrictEqual({
      type: 'notebook',
      value: 'a.ipynb',
      mimetype: 'application/x-ipynb+json',
      cells: [
        {
          id: 'c1',
          input_type: 'code',
          selection: { start: [0, 0], end: [0, 2], content }
        }
      ]
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it('should attach the file over the inserted limit', async () => {
    jest.spyOn(Notification, 'info').mockReturnValue('id');
    const input = makeInput();
    const content = 'x'.repeat(20_001);
    await action.run(
      context(input, {
        path: 'a.py',
        cellId: undefined,
        cellType: undefined,
        ...withContent(content)
      })
    );
    expect(input.addAttachment.mock.calls[0][0]).toStrictEqual({
      type: 'file',
      value: 'a.py',
      selection: { start: [0, 0], end: [0, 2], content }
    });
  });

  it('should add nothing and warn over the limit without a cell type or attachments', async () => {
    const warning = jest.spyOn(Notification, 'warning').mockReturnValue('id');
    const content = 'x'.repeat(20_001);
    // A notebook selection with no cell type: no attachment, no chat opened.
    const openNewChat = jest.fn();
    await action.run(
      context(null, {
        openNewChat,
        cellType: undefined,
        ...withContent(content)
      })
    );
    expect(openNewChat).not.toHaveBeenCalled();
    // An input that cannot take attachments.
    const input = makeInput();
    delete (input as Partial<IInputModel>).addAttachment;
    await action.run(context(input, withContent(content)));
    expect(input.value).toBe('');
    expect(warning).toHaveBeenCalledTimes(2);
    for (const [message] of warning.mock.calls) {
      expect(message).toBe(
        'The selection is longer than 20000 characters and could not be attached to the chat.'
      );
    }
  });

  it('should insert a selection of exactly the inserted limit as text', async () => {
    const input = makeInput();
    await action.run(context(input, withContent('x'.repeat(20_000))));
    expect(input.addAttachment).not.toHaveBeenCalled();
    expect(input.value).toContain('x'.repeat(20_000));
  });

  it('should write nothing to a disposed input', async () => {
    const input = { ...makeInput('draft'), isDisposed: true };
    await action.run(context(input));
    expect(input.value).toBe('draft');
    expect(input.focus).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a path with a backtick',
      { path: 'a`b.ipynb' },
      'From `` a`b.ipynb `` (cell ` c1 `) lines 1-1:'
    ],
    [
      'a cell id that is not an nbformat id',
      { cellId: 'not an id!' },
      'From ` a.ipynb ` lines 1-1:'
    ],
    [
      'a file',
      { path: 'a.py', cellId: undefined, cellType: undefined },
      'From ` a.py ` lines 1-1:'
    ]
  ])('should write the header for %s', async (_, extra, header) => {
    const input = makeInput();
    await action.run(context(input, extra));
    expect(input.value).toBe(`${header}\n\`\`\`\nx=\n\`\`\`\n`);
  });

  it('should not open a chat for a selection over the attached limit', async () => {
    const warning = jest.spyOn(Notification, 'warning').mockReturnValue('id');
    const openNewChat = jest.fn();
    await action.run(
      context(null, { openNewChat, ...withContent('x'.repeat(1_000_001)) })
    );
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toBe(
      'The selection is longer than 1000000 characters and was not added to the chat.'
    );
    expect(openNewChat).not.toHaveBeenCalled();
  });
});
