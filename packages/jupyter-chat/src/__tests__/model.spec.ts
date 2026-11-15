/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Example of [Jest](https://jestjs.io/docs/getting-started) unit tests
 */

import type { IAwareness } from '@jupyter/ydoc';

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
      sendMessage(message: INewMessage): null {
        // No-op
        return null;
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

  describe('stacked messages', () => {
    const time = Date.now() / 1000;
    const messages = [
      { id: 'm1', sender: { username: 'alice' } },
      { id: 'm2', sender: { username: 'bob' }, deleted: true },
      { id: 'm3', sender: { username: 'bob' } }
    ].map(
      (msg, idx) =>
        ({
          type: 'msg',
          body: 'text',
          time: time + idx,
          ...msg
        }) as IMessageContent
    );

    it('should not stack a message on a hidden deleted message', () => {
      const model = new MockChatModel();
      model.messagesInserted(0, messages);
      expect(model.messages[2].stacked).toBe(false);
    });

    it('should stack a message on a shown deleted message', () => {
      const model = new MockChatModel({ config: { showDeleted: true } });
      model.messagesInserted(0, messages);
      expect(model.messages[2].stacked).toBe(true);
    });

    it('should update the stacked messages when showDeleted changes', () => {
      const model = new MockChatModel();
      model.messagesInserted(0, messages);
      model.config = { showDeleted: true };
      expect(model.messages[2].stacked).toBe(true);
      model.config = { showDeleted: false };
      expect(model.messages[2].stacked).toBe(false);
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

    it('should forward the input placeholder to the input model', () => {
      const model = new MockChatModel({
        config: { inputPlaceholder: 'Ask the assistant' }
      });
      expect(model.input.config.inputPlaceholder).toBe('Ask the assistant');
    });

    it('should forward a later input placeholder change to the input model', () => {
      const model = new MockChatModel();
      expect(model.input.config.inputPlaceholder).toBeUndefined();

      model.config = { inputPlaceholder: 'Ask the assistant' };
      expect(model.input.config.inputPlaceholder).toBe('Ask the assistant');
    });
  });

  describe('awareness', () => {
    it('should surface the model awareness on the context', () => {
      class AwareChatModel extends MockChatModel {
        readonly awareness = {} as IAwareness;
      }
      const model = new AwareChatModel();
      const context = new MockChatContext({ model });
      expect(context.awareness).toBe(model.awareness);
    });

    it('should be undefined when the model has no awareness', () => {
      const context = new MockChatContext({ model: new MockChatModel() });
      expect(context.awareness).toBeUndefined();
    });
  });
});
