/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { CopyButton } from '../components/code-blocks/copy-button';
import { ChatReactContext } from '../context';
import { MockChatModel } from './mocks';

describe('CopyButton', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true
    });
  });

  const renderCopyButton = (value = 'console.log("hello")') => {
    const model = new MockChatModel();
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <CopyButton value={value} />
        </ChatReactContext.Provider>
      );
    });
  };

  it('renders with initial aria-label "Copy to clipboard"', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true
    });

    renderCopyButton();
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Copy to clipboard');
    expect(button?.disabled).toBe(false);
  });

  it('updates aria-label to "Copied!" on successful copy and resets after 1s', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true
    });

    renderCopyButton('const x = 42;');
    const button = container.querySelector('button');

    await act(async () => {
      button?.click();
    });

    expect(writeText).toHaveBeenCalledWith('const x = 42;');
    expect(button?.getAttribute('aria-label')).toBe('Copied!');

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(button?.getAttribute('aria-label')).toBe('Copy to clipboard');
  });

  it('resets to "Copy to clipboard" if clipboard write fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const writeText = jest.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true
    });

    renderCopyButton();
    const button = container.querySelector('button');

    await act(async () => {
      button?.click();
    });

    expect(button?.getAttribute('aria-label')).toBe('Copy to clipboard');
    consoleError.mockRestore();
  });

  it('disables button when clipboard API is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true
    });

    renderCopyButton();
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe(
      'Copy to clipboard disabled in insecure context'
    );
  });

  it('cleans up timeout on unmount without errors', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true
    });

    renderCopyButton();
    const button = container.querySelector('button');

    await act(async () => {
      button?.click();
    });

    expect(button?.getAttribute('aria-label')).toBe('Copied!');

    // Unmount while timeout is pending
    act(() => {
      root.unmount();
    });

    // Advance time after unmount — should not throw or trigger state update
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }).not.toThrow();
  });
});

