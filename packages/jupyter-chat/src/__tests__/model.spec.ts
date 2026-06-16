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

  describe('messageChanged signal', () => {
    const msg = {
      type: 'msg',
      id: 'message1',
      time: Date.now() / 1000,
      body: 'original body',
      sender: { username: 'user' }
    } as IMessageContent;

    it('should emit messageChanged when a message is updated', () => {
      const model = new MockChatModel();
      model.messageAdded(msg);

      let emitCount = 0;
      model.messageChanged.connect(() => {
        emitCount++;
      });

      let changedMessage: IMessage | null = null;
      model.messageChanged.connect((sender, message) => {
        changedMessage = message;
      });

      model.messages[0].update({ body: 'updated body' });
      expect(emitCount).toBe(1);
      expect(changedMessage).not.toBeNull();
      expect(changedMessage!.body).toBe('updated body');
    });

    it('should not emit messageChanged after the message is deleted', () => {
      const model = new MockChatModel();
      model.messageAdded(msg);

      let emitCount = 0;
      model.messageChanged.connect(() => {
        emitCount++;
      });

      model.messagesDeleted(0, 1);
      model.messages[0]?.update({ body: 'updated body' });
      expect(emitCount).toBe(0);
    });

    it('should not emit messageChanged after the model is disposed', () => {
      const model = new MockChatModel();
      model.messageAdded(msg);

      let emitCount = 0;
      model.messageChanged.connect(() => {
        emitCount++;
      });

      model.dispose();
      model.messages[0]?.update({ body: 'updated body' });
      expect(emitCount).toBe(0);
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
