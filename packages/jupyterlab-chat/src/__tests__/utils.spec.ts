/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatModel } from '@jupyter/chat';

import { getChatPath, resolveChatRenamePath } from '../utils';

describe('resolveChatRenamePath', () => {
  it('keeps a renamed chat in its original directory', () => {
    expect(resolveChatRenamePath('chats/untitled.chat', 'test')).toBe(
      'chats/test.chat'
    );
  });

  it('ensures the .chat extension', () => {
    expect(resolveChatRenamePath('chats/untitled.chat', 'test.chat')).toBe(
      'chats/test.chat'
    );
  });

  it('leaves root-level chats at the root', () => {
    expect(resolveChatRenamePath('untitled.chat', 'test')).toBe('test.chat');
  });

  it('respects an explicit directory in the new name', () => {
    expect(resolveChatRenamePath('chats/untitled.chat', 'archive/test')).toBe(
      'archive/test.chat'
    );
  });

  it('preserves nested directories', () => {
    expect(resolveChatRenamePath('chats/2024/untitled.chat', 'test')).toBe(
      'chats/2024/test.chat'
    );
  });
});

describe('getChatPath', () => {
  it('returns the path of the model', () => {
    const model = { name: 'Display name', path: 'chats/a.chat' };
    expect(getChatPath(model as unknown as IChatModel)).toBe('chats/a.chat');
  });

  it('returns undefined if the model has no path', () => {
    const model = { name: 'chats/a.chat' };
    expect(getChatPath(model as unknown as IChatModel)).toBeUndefined();
  });
});
