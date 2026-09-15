/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

// React 18 asks test environments to declare themselves, otherwise every
// `act` call warns.
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { ChatInput } from '../components/input/chat-input';
import { ChatReactContext } from '../context';
import { IConfig } from '../types';
import { MockChatModel } from './mocks';

const DEFAULT_PLACEHOLDER = 'Type a chat message, @ to mention...';

describe('ChatInput placeholder', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (config?: IConfig): MockChatModel => {
    const model = new MockChatModel({ config });
    act(() => {
      root.render(
        <ChatReactContext.Provider
          value={{ model, rmRegistry: {} as IRenderMimeRegistry }}
        >
          <ChatInput model={model.input} />
        </ChatReactContext.Provider>
      );
    });
    return model;
  };

  const placeholder = (): string | null =>
    container.querySelector('[role="combobox"]')!.getAttribute('placeholder');

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should use the default placeholder when none is configured', () => {
    render();
    expect(placeholder()).toBe(DEFAULT_PLACEHOLDER);
  });

  it('should use the configured placeholder', () => {
    render({ inputPlaceholder: 'Ask the assistant' });
    expect(placeholder()).toBe('Ask the assistant');
  });

  it('should follow a later change of the configuration', () => {
    const model = render();

    act(() => {
      model.config = { inputPlaceholder: 'Ask the assistant' };
    });
    expect(placeholder()).toBe('Ask the assistant');

    // An empty placeholder means 'use the default one'.
    act(() => {
      model.config = { inputPlaceholder: '' };
    });
    expect(placeholder()).toBe(DEFAULT_PLACEHOLDER);
  });
});
