/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { resolveChatRenamePath } from '../utils';

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
