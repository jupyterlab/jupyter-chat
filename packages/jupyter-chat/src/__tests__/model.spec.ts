/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Example of [Jest](https://jestjs.io/docs/getting-started) unit tests
 */

import { ChatModel, IChatModel } from '../model';
import { IChatMessage } from '../types';

describe('test chat model', () => {
  describe('model instantiation', () => {
    it('should create a ChatModel', () => {
      const model = new ChatModel();
      expect(model).toBeInstanceOf(ChatModel);
    });

    it('should dispose a ChatModel', () => {
      const model = new ChatModel();
      model.dispose();
      expect(model.isDisposed).toBeTruthy();
    });
  });

  describe('incoming message', () => {
    class TestChat extends ChatModel {
      protected formatChatMessage(message: IChatMessage): IChatMessage {
        message.body = 'formatted msg';
        return message;
      }
    }

    let model: IChatModel;
    let messages: IChatMessage[];
    const msg = {
      type: 'msg',
      id: 'message1',
      time: Date.now() / 1000,
      body: 'message test',
      sender: { username: 'user' }
    } as IChatMessage;

    beforeEach(() => {
      messages = [];
    });

    it('should signal incoming message', () => {
      model = new ChatModel();
      model.messagesUpdated.connect((sender: IChatModel) => {
        expect(sender).toBe(model);
        messages = model.messages;
      });
      model.messageAdded(msg);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toBe(msg);
    });

    it('should format message', () => {
      model = new TestChat();
      model.messagesUpdated.connect((sender: IChatModel) => {
        expect(sender).toBe(model);
        messages = model.messages;
      });
      model.messageAdded({ ...msg });
      expect(messages).toHaveLength(1);
      expect(messages[0]).not.toBe(msg);
      expect((messages[0] as IChatMessage).body).toBe('formatted msg');
    });
  });

  describe('model config', () => {
    it('should have empty config', () => {
      const model = new ChatModel();
      expect(model.config.sendWithShiftEnter).toBeUndefined();
    });

    it('should allow config', () => {
      const model = new ChatModel({ config: { sendWithShiftEnter: true } });
      expect(model.config.sendWithShiftEnter).toBeTruthy();
    });
  });
});
