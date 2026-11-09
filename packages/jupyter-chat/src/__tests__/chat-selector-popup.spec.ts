/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatSelectorPopup } from '../widgets/chat-selector-popup';

/**
 * The chats rendered by the popup, as [key, name] pairs.
 */
const renderedChats = (popup: ChatSelectorPopup): [string, string][] =>
  popup
    .render()
    .props.chats.map(({ key, name }: { key: string; name: string }) => [
      key,
      name
    ]);

describe('ChatSelectorPopup', () => {
  it('sorts names containing numbers naturally', () => {
    const popup = new ChatSelectorPopup({
      chats: { a: 'untitled10', b: 'untitled2', c: 'untitled1' }
    });

    expect(renderedChats(popup)).toEqual([
      ['c', 'untitled1'],
      ['b', 'untitled2'],
      ['a', 'untitled10']
    ]);
    popup.dispose();
  });

  it('lists chats with the same name separately', () => {
    const popup = new ChatSelectorPopup({
      chats: { 'a/chat.chat': 'chat', 'b/chat.chat': 'chat' }
    });

    expect(renderedChats(popup).map(([key]) => key)).toEqual([
      'a/chat.chat',
      'b/chat.chat'
    ]);
    popup.dispose();
  });

  it('lists the loaded chats first, with their loaded name', () => {
    const popup = new ChatSelectorPopup({
      chats: { a: 'alpha', b: 'beta' }
    });
    popup.setLoadedModels({ b: 'renamed beta', c: 'gamma' });

    expect(renderedChats(popup)).toEqual([
      ['c', 'gamma'],
      ['b', 'renamed beta'],
      ['a', 'alpha']
    ]);
    popup.dispose();
  });

  it('filters by name and selects by key', () => {
    const onSelect = jest.fn();
    const popup = new ChatSelectorPopup({
      chats: { 'chats/a.chat': 'alpha', 'chats/b.chat': 'beta' },
      onSelect
    });
    popup.setQuery('bet');

    expect(renderedChats(popup)).toEqual([['chats/b.chat', 'beta']]);
    expect(popup.getSelectedValue()).toBe('chats/b.chat');

    popup.render().props.onSelect('chats/b.chat');
    expect(onSelect).toHaveBeenCalledWith('chats/b.chat');
    popup.dispose();
  });
});
