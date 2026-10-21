/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatModel } from '../model';
import { IUser } from '../types';
import { MockChatModel } from './mocks';

const userA: IUser = { username: 'a', name: 'Alice', display_name: 'Alice' };
const userB: IUser = { username: 'b', name: 'Bob', display_name: 'Bob' };

describe('writers state', () => {
  let model: MockChatModel;
  let changes: IChatModel.IWriter[][];

  beforeEach(() => {
    model = new MockChatModel();
    changes = [];
    model.writersChanged?.connect((_, writers) => changes.push(writers));
  });

  afterEach(() => {
    model.dispose();
  });

  it('adds and removes a writer per user', () => {
    model.setWritingStatus(userA);
    expect(model.writers.map(w => w.user.username)).toEqual(['a']);

    model.setWritingStatus(userB);
    expect(model.writers.map(w => w.user.username).sort()).toEqual(['a', 'b']);

    model.clearWritingStatus(userA);
    expect(model.writers.map(w => w.user.username)).toEqual(['b']);
  });

  it('carries a custom typingIndicator', () => {
    model.setWritingStatus(userA, { typingIndicator: 'is running ripgrep' });
    expect(model.writers[0].typingIndicator).toBe('is running ripgrep');
  });

  it('does not re-emit when the status is unchanged', () => {
    model.setWritingStatus(userA, { typingIndicator: 'x' });
    const count = changes.length;
    model.setWritingStatus(userA, { typingIndicator: 'x' });
    expect(changes.length).toBe(count);
  });

  it('keeps a writer until it is explicitly cleared (no auto-expiry)', () => {
    jest.useFakeTimers();
    try {
      model.setWritingStatus(userA);
      expect(model.writers).toHaveLength(1);

      // A single call persists like any other update: no timer drops it.
      jest.advanceTimersByTime(60_000);
      expect(model.writers).toHaveLength(1);

      // Only an explicit clear removes it.
      model.clearWritingStatus(userA);
      expect(model.writers).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('updateWriters replaces the whole list', () => {
    model.setWritingStatus(userA);
    model.updateWriters([{ user: userB }]);
    expect(model.writers.map(w => w.user.username)).toEqual(['b']);
  });
});
