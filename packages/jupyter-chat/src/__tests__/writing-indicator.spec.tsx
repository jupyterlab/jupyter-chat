/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

// React 18 asks test environments to declare themselves, otherwise every
// `act` call warns.
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { WritingIndicator } from '../components/writing-indicator';
import { IChatModel } from '../model';
import { IUser } from '../types';

const alice: IUser = { username: 'a', name: 'Alice', display_name: 'Alice' };

const writer = (user: IUser, typingIndicator?: string): IChatModel.IWriter =>
  ({ user, typingIndicator }) as IChatModel.IWriter;

describe('WritingIndicator accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (writers: IChatModel.IWriter[]) => {
    act(() => {
      root.render(<WritingIndicator writers={writers} />);
    });
    return container.querySelector('.jp-chat-writers') as HTMLElement;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('is a polite live region, so a reply on its way is announced', () => {
    // The indicator is the only signal that someone is replying. Without a
    // live region it is visible text that assistive technology never speaks.
    const el = render([]);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('reads the whole phrase rather than a fragment of it', () => {
    // Without aria-atomic, a change to part of the text can be announced on
    // its own, so a reader hears a bare name with no context.
    expect(render([]).getAttribute('aria-atomic')).toBe('true');
  });

  it('announces who is writing', () => {
    expect(render([writer(alice)]).textContent).toContain('Alice is typing');
  });

  it('announces a custom indicator, not just a generic one', () => {
    const el = render([writer(alice, 'is running `ripgrep`')]);
    expect(el.textContent).toContain('Alice is running `ripgrep`');
  });

  it('says nothing when nobody is writing', () => {
    // The container is always rendered to reserve space, and holds a
    // non-breaking space as a placeholder. That placeholder must not be
    // announced as if it were a message.
    const text = (render([]).textContent ?? '').replace(/ /g, '').trim();
    expect(text).toBe('');
  });
});
