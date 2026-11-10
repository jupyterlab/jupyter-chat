/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatName } from '../widgets/chat-name';
import { MockChatModel } from './mocks';

describe('ChatName', () => {
  let model: MockChatModel;

  beforeEach(() => {
    model = new MockChatModel();
    model.name = 'My chat';
  });

  afterEach(() => {
    model.dispose();
  });

  it('should display the model name', () => {
    const chatName = new ChatName({ model });
    expect(chatName.hasClass('jp-chat-name')).toBe(true);
    expect(chatName.node.textContent).toBe('My chat');
    expect(chatName.node.title).toBe('My chat');
    chatName.dispose();
  });

  it('should follow the model name', () => {
    const chatName = new ChatName({ model });
    model.name = 'Renamed chat';
    expect(chatName.node.textContent).toBe('Renamed chat');
    expect(chatName.node.title).toBe('Renamed chat');
    chatName.dispose();
  });

  it('should stop following the model name once disposed', () => {
    const chatName = new ChatName({ model });
    const node = chatName.node;
    chatName.dispose();
    model.name = 'Renamed chat';
    expect(node.textContent).toBe('My chat');
  });
});
