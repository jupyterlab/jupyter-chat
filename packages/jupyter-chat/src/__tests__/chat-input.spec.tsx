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

import { SendButton } from '../components/input/buttons/send-button';
import { ChatInput } from '../components/input/chat-input';
import { ChatReactContext } from '../context';
import { IConfig, PendingSnippet } from '../types';
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

  it('should use an empty configured placeholder as is', () => {
    render({ inputPlaceholder: '' });
    expect(placeholder()).toBe('');
  });

  it('should follow a later change of the configuration', () => {
    const model = render();

    act(() => {
      model.config = { inputPlaceholder: 'Ask the assistant' };
    });
    expect(placeholder()).toBe('Ask the assistant');

    // Unsetting it is the way back to the default, an empty string is not.
    act(() => {
      model.config = { inputPlaceholder: '' };
    });
    expect(placeholder()).toBe('');

    act(() => {
      model.config = { inputPlaceholder: undefined };
    });
    expect(placeholder()).toBe(DEFAULT_PLACEHOLDER);
  });

  it('should keep the default placeholder on an unrelated change', () => {
    const model = render();

    act(() => {
      model.config = { sendWithShiftEnter: true };
    });
    expect(placeholder()).toBe(DEFAULT_PLACEHOLDER);
  });
});

describe('ChatInput pending snippets', () => {
  let container: HTMLDivElement;
  let root: Root;

  const SNIPPET: PendingSnippet = {
    path: 'src/analysis/model.py',
    cellId: '3f9a1c2e-0000-4000-8000-000000000000',
    selection: { start: [2, 0], end: [4, 3], content: 'x = 1' }
  };

  const render = (stage?: PendingSnippet): MockChatModel => {
    const model = new MockChatModel();
    if (stage) {
      model.input.addPendingSnippet?.(stage);
    }
    act(() => {
      root.render(
        <ChatReactContext.Provider
          value={{ model, rmRegistry: {} as IRenderMimeRegistry }}
        >
          <ChatInput model={model.input} />
          <SendButton model={model.input} chatModel={model} />
        </ChatReactContext.Provider>
      );
    });
    return model;
  };

  const chips = () => container.querySelectorAll('.jp-chat-pending-snippet');

  const sendDisabled = (): boolean =>
    (container.querySelector('.jp-chat-send-button') as HTMLButtonElement)
      .disabled;

  const pressEnter = async (): Promise<void> => {
    const textarea = container.querySelector('[role="combobox"]')!;
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        })
      );
    });
  };

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

  it('should show a staged snippet and enable Send until it is removed', () => {
    const model = render();
    expect(chips()).toHaveLength(0);
    expect(sendDisabled()).toBe(true);

    act(() => {
      model.input.addPendingSnippet?.(SNIPPET);
    });
    expect(chips()).toHaveLength(1);
    expect(chips()[0].textContent).toBe('model.py · cell 3f9a1c2e · lines 3-5');
    expect(sendDisabled()).toBe(false);

    act(() => {
      (
        container.querySelector(
          '.jp-chat-pending-snippet-remove button'
        ) as HTMLElement
      ).click();
    });
    expect(model.input.pendingSnippets).toEqual([]);
    expect(chips()).toHaveLength(0);
    expect(sendDisabled()).toBe(true);
  });

  it('should show a snippet staged between the first render and the effects', () => {
    const model = new MockChatModel();
    // The render reads no snippet; the one staged right after it emitted nothing.
    jest
      .spyOn(model.input, 'pendingSnippets', 'get')
      .mockReturnValueOnce([])
      .mockReturnValue([SNIPPET]);
    act(() => {
      root.render(
        <ChatReactContext.Provider
          value={{ model, rmRegistry: {} as IRenderMimeRegistry }}
        >
          <ChatInput model={model.input} />
        </ChatReactContext.Provider>
      );
    });
    expect(chips()).toHaveLength(1);
  });

  it('should send on Enter with a snippet and no text', async () => {
    const model = render(SNIPPET);
    const send = jest.spyOn(model.input, 'send');
    await pressEnter();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
