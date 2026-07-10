/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { InputModel } from '../input-model';
import { INewMessage } from '../types';

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
