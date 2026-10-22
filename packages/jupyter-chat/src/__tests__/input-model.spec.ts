/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { submitInputMessage } from '../components/input/submit-message';
import { InputModel } from '../input-model';
import { IChatCommandRegistry } from '../registers';
import { INewMessage, INotebookAttachment, PendingSnippet } from '../types';

function snippet(
  content: string,
  extra: Partial<PendingSnippet> = {},
  end: [number, number] = [0, content.length]
): PendingSnippet {
  return {
    path: 'a.py',
    selection: { start: [0, 0], end, content },
    ...extra
  };
}

describe('test input model', () => {
  describe('metadata', () => {
    it('should start with empty metadata', () => {
      const model = new InputModel({ onSend: jest.fn() });
      expect(model.getMetadata()).toEqual({});
    });

    it('should seed metadata from options', () => {
      const model = new InputModel({
        onSend: jest.fn(),
        metadata: { persona: 'kiro' }
      });
      expect(model.getMetadata()).toEqual({ persona: 'kiro' });
    });

    it('should merge patches with updateMetadata', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.updateMetadata({ persona: 'kiro' });
      model.updateMetadata({ model: { id: 'claude-opus-48' } });
      expect(model.getMetadata()).toEqual({
        persona: 'kiro',
        model: { id: 'claude-opus-48' }
      });
    });

    it('should overwrite existing keys on update', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.updateMetadata({ persona: 'kiro' });
      model.updateMetadata({ persona: 'jupyternaut' });
      expect(model.getMetadata()).toEqual({ persona: 'jupyternaut' });
    });

    it('should shallow-merge: a top-level key replaces the whole value', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.updateMetadata({ model: { id: 'a' } });
      // Passing `model` again replaces it wholesale (no recursive merge).
      model.updateMetadata({ model: { id: 'b' } });
      expect(model.getMetadata()).toEqual({ model: { id: 'b' } });
    });

    it('should not be mutated by later changes to a patch', () => {
      const model = new InputModel({ onSend: jest.fn() });
      const patch = { model: { id: 'a' } };
      model.updateMetadata(patch);
      // Mutating the patch after the fact must not reach into stored metadata.
      patch.model.id = 'tampered';
      expect(model.getMetadata()).toEqual({ model: { id: 'a' } });
    });

    it('should clear metadata', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.updateMetadata({ persona: 'kiro' });
      model.clearMetadata();
      expect(model.getMetadata()).toEqual({});
    });

    it('should emit metadataChanged on update and clear', () => {
      const model = new InputModel({ onSend: jest.fn() });
      const emitted: any[] = [];
      model.metadataChanged?.connect((_, metadata) => {
        emitted.push({ ...metadata });
      });
      model.updateMetadata({ persona: 'kiro' });
      model.clearMetadata();
      expect(emitted).toEqual([{ persona: 'kiro' }, {}]);
    });
  });

  describe('send', () => {
    it('should attach metadata to the message when non-empty', () => {
      const onSend = jest.fn();
      const model = new InputModel({ onSend });
      model.updateMetadata({ persona: 'kiro' });
      model.send('hello');

      const message: INewMessage = onSend.mock.calls[0][0];
      expect(message.body).toBe('hello');
      expect(message.metadata).toEqual({ persona: 'kiro' });
    });

    it('should omit metadata from the message when empty', () => {
      const onSend = jest.fn();
      const model = new InputModel({ onSend });
      model.send('hello');

      const message: INewMessage = onSend.mock.calls[0][0];
      expect(message.metadata).toBeUndefined();
    });

    it('should send a copy of the metadata', () => {
      const onSend = jest.fn();
      const model = new InputModel({ onSend });
      model.updateMetadata({ persona: 'kiro' });
      model.send('hello');

      const message: INewMessage = onSend.mock.calls[0][0];
      model.updateMetadata({ persona: 'jupyternaut' });
      expect(message.metadata).toEqual({ persona: 'kiro' });
    });

    it('should keep metadata after sending (sticky selection)', () => {
      // Unlike attachments/mentions, metadata carries the picker's
      // persona/model/settings selection, which is sticky across messages.
      const model = new InputModel({ onSend: jest.fn() });
      model.updateMetadata({ persona: 'kiro' });
      model.send('hello');
      expect(model.getMetadata()).toEqual({ persona: 'kiro' });
    });
  });

  describe('pending snippets', () => {
    function setup() {
      const onSend = jest.fn();
      const model = new InputModel({ onSend });
      // The body of the message that was sent.
      const body = (): string => onSend.mock.calls[0][0].body;
      return { model, onSend, body };
    }

    it('should stage, dedupe by value and remove by identity', () => {
      const { model } = setup();
      const changed = jest.fn();
      model.pendingSnippetsChanged.connect(changed);
      const first = snippet('x = 1', { cellId: 'c1' });

      expect(model.addPendingSnippet(first)).toBe(true);
      expect(changed).toHaveBeenCalledWith(model, [first]);
      // Equal by value: accepted, not staged twice.
      expect(model.addPendingSnippet(snippet('x = 1', { cellId: 'c1' }))).toBe(
        true
      );
      // The same text in another cell or range is another snippet.
      model.addPendingSnippet(snippet('x = 1', { cellId: 'c2' }));
      model.addPendingSnippet(snippet('x = 1', { cellId: 'c2' }, [3, 1]));
      expect(model.pendingSnippets).toHaveLength(3);
      expect(changed).toHaveBeenCalledTimes(3);

      model.removePendingSnippet(snippet('x = 1', { cellId: 'c1' }));
      expect(model.pendingSnippets).toHaveLength(3);
      model.removePendingSnippet(first);
      expect(model.pendingSnippets).toHaveLength(2);
    });

    // Typed text, staged snippets, and the body that is sent.
    it.each<[string, string, PendingSnippet[], string]>([
      [
        'a snippet after the text and a blank line',
        'explain',
        [snippet('x = 1', { cellId: 'c1' })],
        'explain\n\nFrom ` a.py ` (cell ` c1 `) lines 1-1:\n```\nx = 1\n```'
      ],
      [
        'a snippet alone for a blank text',
        '  \n',
        [snippet('x = 1')],
        'From ` a.py ` lines 1-1:\n```\nx = 1\n```'
      ]
    ])('should compose %s', (_, text, snippets, expected) => {
      const { model, body } = setup();
      snippets.forEach(staged => model.addPendingSnippet(staged));
      model.send(text);
      expect(body()).toBe(expected);
    });

    it('should clear the staged snippets after sending, however send is called', () => {
      const { model, body } = setup();
      model.addPendingSnippet(snippet('x'));
      const changed = jest.fn();
      model.pendingSnippetsChanged.connect(changed);

      // Another package may call the function detached from the model.
      const { send } = model;
      send.call({} as any, 'text');
      expect(body().startsWith('text\n\nFrom ')).toBe(true);
      expect(model.pendingSnippets).toEqual([]);
      expect(changed).toHaveBeenCalledWith(model, []);
    });

    it('should compose after the command providers ran on the typed text only', async () => {
      const { model, onSend } = setup();
      // A provider that adds an attachment for every `@file:` in the value, as
      // the file command of jupyter-ai-chat-commands does.
      const registry = {
        onSubmit: jest.fn(async (input: InputModel) => {
          for (const word of input.value.split(/\s+/)) {
            if (word.startsWith('@file:')) {
              input.addAttachment({ type: 'file', value: word.slice(6) });
            }
          }
        })
      } as unknown as IChatCommandRegistry;
      model.addPendingSnippet(snippet('@file:x.md'));
      model.value = 'see @file:notes.md';

      await submitInputMessage({ model, chatCommandRegistry: registry });

      const message: INewMessage = onSend.mock.calls[0][0];
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments![0].value).toBe('notes.md');
      expect(message.body).toBe(
        'see @file:notes.md\n\nFrom ` a.py ` lines 1-1:\n```\n@file:x.md\n```'
      );
    });
  });

  describe('attachments', () => {
    it('should add attachments', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.addAttachment({ type: 'file', value: 'data.csv' });
      expect(model.attachments).toEqual([{ type: 'file', value: 'data.csv' }]);
    });

    it('should not add duplicate file attachments', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.addAttachment({ type: 'file', value: 'data.csv' });
      model.addAttachment({ type: 'file', value: 'data.csv' });
      expect(model.attachments).toHaveLength(1);
    });

    it('should merge cells from same notebook and filter duplicate cells', () => {
      const model = new InputModel({ onSend: jest.fn() });
      model.addAttachment({
        type: 'notebook',
        value: 'analysis.ipynb',
        cells: [
          { id: 'cell-1', input_type: 'code' },
          { id: 'cell-2', input_type: 'markdown' }
        ]
      });

      // Add overlapping and new cells
      model.addAttachment({
        type: 'notebook',
        value: 'analysis.ipynb',
        cells: [
          { id: 'cell-2', input_type: 'markdown' },
          { id: 'cell-3', input_type: 'code' }
        ]
      });

      expect(model.attachments).toHaveLength(1);
      const nbAttachment = model.attachments[0] as INotebookAttachment;
      expect(nbAttachment.cells).toEqual([
        { id: 'cell-1', input_type: 'code' },
        { id: 'cell-2', input_type: 'markdown' },
        { id: 'cell-3', input_type: 'code' }
      ]);
    });

    it('should do nothing if all added cells already exist in the attachment', () => {
      const model = new InputModel({ onSend: jest.fn() });
      const emitted: any[] = [];
      model.attachmentsChanged?.connect((_, atts) => {
        emitted.push(atts);
      });

      model.addAttachment({
        type: 'notebook',
        value: 'analysis.ipynb',
        cells: [{ id: 'cell-1', input_type: 'code' }]
      });

      expect(emitted).toHaveLength(1);

      // Re-adding the exact same cell should early-return without emitting
      model.addAttachment({
        type: 'notebook',
        value: 'analysis.ipynb',
        cells: [{ id: 'cell-1', input_type: 'code' }]
      });

      expect(emitted).toHaveLength(1);
    });

    it('should remove attachments', () => {
      const model = new InputModel({ onSend: jest.fn() });
      const attachment = { type: 'file' as const, value: 'data.csv' };
      model.addAttachment(attachment);
      expect(model.attachments).toHaveLength(1);

      model.removeAttachment(attachment);
      expect(model.attachments).toHaveLength(0);
    });
  });
});

// `IMessageMetadata` is intentionally empty in the source; consumers augment it
// with their own fields via module augmentation. We do the same here purely so
// the tests can exercise `updateMetadata` with representative fields — this
// stays in the test file and no consumer-specific fields leak into the source.
declare module '../types' {
  interface IMessageMetadata {
    persona?: string;
    model?: { id: string };
  }
}
