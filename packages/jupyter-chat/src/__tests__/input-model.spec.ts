/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { InputModel } from '../input-model';
import { INewMessage, INotebookAttachment } from '../types';

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
