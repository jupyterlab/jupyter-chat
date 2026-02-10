/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Example of [Jest](https://jestjs.io/docs/getting-started) unit tests
 */

import { AbstractChatModel, IChatContext, IChatModel } from '../model';
import { IMessage, IMessageContent, INewMessage } from '../types';
import { MockChatModel, MockChatContext } from './mocks';

describe('test chat model', () => {
  describe('model instantiation', () => {
    it('should create an AbstractChatModel', () => {
      const model = new MockChatModel();
      expect(model).toBeInstanceOf(AbstractChatModel);
    });

    it('should dispose an AbstractChatModel', () => {
      const model = new MockChatModel();
      model.dispose();
      expect(model.isDisposed).toBeTruthy();
    });
  });

  describe('incoming message', () => {
    class TestChat extends AbstractChatModel implements IChatModel {
      protected formatChatMessage(message: IMessageContent): IMessageContent {
        message.body = 'formatted msg';
        return message;
      }
      sendMessage(
        message: INewMessage
      ): Promise<boolean | void> | boolean | void {
        // No-op
      }

      createChatContext(): IChatContext {
        return new MockChatContext({ model: this });
      }
    }

    let model: IChatModel;
    let messages: IMessage[];
    const msg = {
      type: 'msg',
      id: 'message1',
      time: Date.now() / 1000,
      body: 'message test',
      sender: { username: 'user' }
    } as IMessageContent;

    beforeEach(() => {
      messages = [];
    });

    it('should signal incoming message', () => {
      model = new MockChatModel();
      model.messagesUpdated.connect((sender: IChatModel) => {
        expect(sender).toBe(model);
        messages = model.messages;
      });
      model.messageAdded(msg);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(msg);
    });

    it('should format message', () => {
      model = new TestChat();
      model.messagesUpdated.connect((sender: IChatModel) => {
        expect(sender).toBe(model);
        messages = model.messages;
      });
      model.messageAdded({ ...msg });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).not.toBe(msg);
      expect(messages[0].body).toBe('formatted msg');
    });
  });

  describe('model config', () => {
    it('should have empty config', () => {
      const model = new MockChatModel();
      expect(model.config.sendWithShiftEnter).toBeUndefined();
    });

    it('should allow config', () => {
      const model = new MockChatModel({ config: { sendWithShiftEnter: true } });
      expect(model.config.sendWithShiftEnter).toBeTruthy();
    });
  });
});
