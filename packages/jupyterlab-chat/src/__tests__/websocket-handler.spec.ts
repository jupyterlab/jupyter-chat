/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Signal } from '@lumino/signaling';

import { LabChatModel } from '../model';
import { IWidgetConfig } from '../token';
import { WebSocketHandler } from '../websocket-handler';
import { SERVER } from '../ws-messages';
import { YChat } from '../ychat';

const TEST_USER = {
  username: 'test-user',
  name: 'Test User',
  display_name: 'Test',
  initials: 'TU',
  color: '#aabbcc'
};

const REMOTE_USER = {
  username: 'remote-user',
  name: 'Remote User',
  display_name: 'Remote',
  initials: 'RU'
};

function makeWidgetConfig(): IWidgetConfig {
  const owner = {} as IWidgetConfig;
  owner.config = {};
  (owner as any).configChanged = new Signal<IWidgetConfig, any>(owner);
  return owner;
}

function makeModel(): LabChatModel {
  const model = new LabChatModel({
    widgetConfig: makeWidgetConfig(),
    user: TEST_USER,
    sharedModel: YChat.create(),
    collaborative: false
  });
  model.markDocumentSynced();
  return model;
}

/**
 * Create a handler wired to `model` but with no live socket.
 * `initialize()` is intentionally not called so no WebSocket is opened.
 */
function makeHandler(model: LabChatModel): WebSocketHandler {
  return new WebSocketHandler({
    serverSettings: {} as any,
    model
  });
}

/** Feed a server frame directly into the handler's private message processor. */
function dispatch(handler: WebSocketHandler, frame: object): void {
  (handler as any)._handleMessage({ type: SERVER, ...frame });
}

describe('WebSocketHandler._handleMessage', () => {
  let model: LabChatModel;
  let handler: WebSocketHandler;

  beforeEach(() => {
    model = makeModel();
    handler = makeHandler(model);
  });

  afterEach(() => {
    Signal.clearData(model);
    handler.dispose();
  });

  describe('writing frame', () => {
    it('adds the writer to the model when state is true', () => {
      dispatch(handler, {
        action: 'writing',
        user: REMOTE_USER,
        state: true,
        typingIndicator: 'is writing!'
      });

      const writers = model.writers;
      expect(writers).toHaveLength(1);
      expect(writers[0].user.username).toBe('remote-user');
      expect(writers[0].typingIndicator).toBe('is writing!');
    });

    it('removes the writer from the model when state is false', () => {
      dispatch(handler, { action: 'writing', user: REMOTE_USER, state: true });
      dispatch(handler, { action: 'writing', user: REMOTE_USER, state: false });

      expect(model.writers).toHaveLength(0);
    });

    it('ignores the frame when the user is the connected user', () => {
      dispatch(handler, { action: 'writing', user: TEST_USER, state: true });

      expect(model.writers).toHaveLength(0);
    });
  });

  describe('metadata frame', () => {
    it('applies the metadata key to the shared model', () => {
      dispatch(handler, {
        action: 'metadata',
        metadata: { banner: { text: 'hello from server' } }
      });

      expect(model.sharedModel.getSource().metadata).toMatchObject({
        banner: { text: 'hello from server' }
      });
    });

    it('applies multiple metadata keys in one frame', () => {
      dispatch(handler, {
        action: 'metadata',
        metadata: { foo: 'a', bar: 'b' }
      });

      const metadata = model.sharedModel.getSource().metadata;
      expect(metadata).toMatchObject({ foo: 'a', bar: 'b' });
    });
  });

  describe('users frame', () => {
    it('adds the user to the shared model', () => {
      dispatch(handler, {
        action: 'users',
        users: { 'remote-user': REMOTE_USER }
      });

      const stored = model.sharedModel.getUser('remote-user');
      expect(stored).toMatchObject({
        username: 'remote-user',
        display_name: 'Remote'
      });
    });

    it('does not overwrite a user that is already in the shared model', () => {
      model.sharedModel.setUser({ ...REMOTE_USER, display_name: 'Original' });

      dispatch(handler, {
        action: 'users',
        users: { 'remote-user': { ...REMOTE_USER, display_name: 'Updated' } }
      });

      expect(model.sharedModel.getUser('remote-user')?.display_name).toBe(
        'Original'
      );
    });
  });
});
