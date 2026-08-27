/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { UUID } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';

import { LabChatModel } from '../model';
import { IWidgetConfig } from '../token';
import { YChat } from '../ychat';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const TEST_USER = {
  username: 'test-user',
  name: 'Test User',
  display_name: 'Test',
  initials: 'TU',
  color: '#aabbcc'
};

function makeWidgetConfig(): IWidgetConfig {
  const owner = {} as IWidgetConfig;
  owner.config = {};
  (owner as any).configChanged = new Signal<IWidgetConfig, any>(owner);
  return owner;
}

describe('LabChatModel', () => {
  let sharedModel: YChat;
  let model: LabChatModel;

  beforeEach(() => {
    sharedModel = YChat.create();
    model = new LabChatModel({
      widgetConfig: makeWidgetConfig(),
      user: TEST_USER,
      sharedModel
    });
    model.markDocumentSynced();
  });

  afterEach(() => {
    Signal.clearData(model);
    sharedModel.dispose();
  });

  describe('message attribute updates from shared model', () => {
    it('should reflect a body change', async () => {
      const id = UUID.uuid4();
      sharedModel.addMessage({
        type: 'msg',
        id,
        body: 'original',
        time: 1000,
        sender: TEST_USER.username
      });
      await flushPromises();

      sharedModel.updateMessage(0, {
        type: 'msg',
        id,
        body: 'updated',
        time: 1000,
        sender: TEST_USER.username
      });
      await flushPromises();

      expect(model.messages[0].body).toBe('updated');
    });

    it('should reflect a mime_model change', async () => {
      const id = UUID.uuid4();
      sharedModel.addMessage({
        type: 'msg',
        id,
        body: '',
        time: 1000,
        sender: TEST_USER.username
      });
      await flushPromises();

      const mimeModel = { data: { 'text/plain': 'streamed output' } };
      sharedModel.updateMessage(0, {
        type: 'msg',
        id,
        body: '',
        time: 1000,
        sender: TEST_USER.username,
        mime_model: mimeModel
      });
      await flushPromises();

      expect(model.messages[0].mime_model).toEqual(mimeModel);
    });

    it('should not set edited when only mime_model changes', async () => {
      const id = UUID.uuid4();
      sharedModel.addMessage({
        type: 'msg',
        id,
        body: '',
        time: 1000,
        sender: TEST_USER.username
      });
      await flushPromises();

      sharedModel.updateMessage(0, {
        type: 'msg',
        id,
        body: '',
        time: 1000,
        sender: TEST_USER.username,
        mime_model: { data: { 'text/plain': 'streamed output' } }
      });
      await flushPromises();

      expect(model.messages[0].edited).toBeUndefined();
    });
  });

  describe('ready resolves after messages are loaded', () => {
    it('messages present in sharedModel before sync are buffered, not yet in model', () => {
      const sm = YChat.create();
      const m = new LabChatModel({
        widgetConfig: makeWidgetConfig(),
        user: TEST_USER,
        sharedModel: sm,
        collaborative: true
      });
      sm.addMessage({
        type: 'msg',
        id: UUID.uuid4(),
        body: 'pre-sync',
        time: 1000,
        sender: TEST_USER.username
      });
      // Not yet synced: message must be buffered, not inserted.
      expect(m.messages).toHaveLength(0);
      sm.dispose();
    });

    it('messages are in model.messages when ready resolves', async () => {
      const sm = YChat.create();
      const m = new LabChatModel({
        widgetConfig: makeWidgetConfig(),
        user: TEST_USER,
        sharedModel: sm,
        collaborative: true
      });
      sm.addMessage({
        type: 'msg',
        id: UUID.uuid4(),
        body: 'pre-sync',
        time: 1000,
        sender: TEST_USER.username
      });

      m.markDocumentSynced();
      await m.ready;

      expect(m.messages).toHaveLength(1);
      expect(m.messages[0].body).toBe('pre-sync');
      sm.dispose();
    });

    it('model.messages is already populated inside the ready .then() callback', async () => {
      const sm = YChat.create();
      const m = new LabChatModel({
        widgetConfig: makeWidgetConfig(),
        user: TEST_USER,
        sharedModel: sm,
        collaborative: true
      });
      sm.addMessage({
        type: 'msg',
        id: UUID.uuid4(),
        body: 'pre-sync',
        time: 1000,
        sender: TEST_USER.username
      });

      let messagesAtReady = -1;
      const check = m.ready.then(() => {
        messagesAtReady = m.messages.length;
      });

      m.markDocumentSynced();
      await check;

      expect(messagesAtReady).toBe(1);
      sm.dispose();
    });

    it('messages added after sync are inserted directly without buffering', async () => {
      await model.ready;

      sharedModel.addMessage({
        type: 'msg',
        id: UUID.uuid4(),
        body: 'post-sync',
        time: 1000,
        sender: TEST_USER.username
      });

      expect(model.messages).toHaveLength(1);
      expect(model.messages[0].body).toBe('post-sync');
    });
  });

  describe('rerender tracking', () => {
    it('should replace renderedDelegate when mime_model changes', async () => {
      const id = UUID.uuid4();
      sharedModel.addMessage({
        type: 'msg',
        id,
        body: '',
        time: 1000,
        sender: TEST_USER.username
      });
      await flushPromises();

      const delegateBefore = model.messages[0].renderedDelegate;

      sharedModel.updateMessage(0, {
        type: 'msg',
        id,
        body: '',
        time: 1000,
        sender: TEST_USER.username,
        mime_model: { data: { 'text/plain': 'streamed output' } }
      });
      await flushPromises();

      expect(model.messages[0].renderedDelegate).not.toBe(delegateBefore);
    });

    it('should not replace renderedDelegate when only edited changes', async () => {
      const id = UUID.uuid4();
      sharedModel.addMessage({
        type: 'msg',
        id,
        body: 'hello',
        time: 1000,
        sender: TEST_USER.username
      });
      await flushPromises();

      const delegateBefore = model.messages[0].renderedDelegate;

      sharedModel.updateMessage(0, {
        type: 'msg',
        id,
        body: 'hello',
        time: 1000,
        sender: TEST_USER.username,
        edited: true
      });
      await flushPromises();

      expect(model.messages[0].renderedDelegate).toBe(delegateBefore);
    });
  });
});
