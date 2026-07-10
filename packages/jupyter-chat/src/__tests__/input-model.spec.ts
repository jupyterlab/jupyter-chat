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

// Extend IMessageMetadata so the tests above can use arbitrary fields.
declare module '../types' {
  interface IMessageMetadata {
    persona?: string;
    model?: { id: string };
  }
}
