/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Signal } from '@lumino/signaling';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { IActiveCellManager } from '../active-cell-manager';
import { CodeToolbar } from '../components/code-blocks/code-toolbar';
import { ChatReactContext } from '../context';
import { IConfig } from '../types';
import { MockChatModel } from './mocks';

function createMockActiveCellManager(available = false): IActiveCellManager {
  return {
    available,
    activeCellError: null,
    availabilityChanged: new Signal({} as any),
    activeCellErrorChanged: new Signal({} as any),
    getContent: () => null,
    insertAbove: jest.fn(),
    insertBelow: jest.fn(),
    replace: jest.fn()
  };
}

describe('CodeToolbar', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderToolbar = (options?: {
    config?: IConfig;
    activeCellManager?: IActiveCellManager | null;
    content?: string;
  }): MockChatModel => {
    const model = new MockChatModel({
      config: options?.config,
      activeCellManager: options?.activeCellManager ?? null
    });
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <CodeToolbar
            model={model}
            content={options?.content ?? 'print("hello")'}
          />
        </ChatReactContext.Provider>
      );
    });
    return model;
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

  it('should render only the copy button when activeCellManager is null', () => {
    renderToolbar({ activeCellManager: null });
    const toolbar = container.querySelector('.jp-chat-code-toolbar');
    expect(toolbar).not.toBeNull();

    const items = container.querySelectorAll('.jp-chat-code-toolbar-item');
    expect(items.length).toBe(1);

    const copyBtn = container.querySelector(
      'button[aria-label="Copy to clipboard"]'
    );
    expect(copyBtn).not.toBeNull();
  });

  it('should render all 4 buttons when activeCellManager is provided', () => {
    const activeCellManager = createMockActiveCellManager(false);
    renderToolbar({ activeCellManager });

    const toolbar = container.querySelector('.jp-chat-code-toolbar');
    expect(toolbar).not.toBeNull();

    const items = container.querySelectorAll('.jp-chat-code-toolbar-item');
    expect(items.length).toBe(4);
  });

  it('should not render toolbar when enableCodeToolbar is false', () => {
    renderToolbar({
      config: { enableCodeToolbar: false },
      activeCellManager: null
    });
    const toolbar = container.querySelector('.jp-chat-code-toolbar');
    expect(toolbar).toBeNull();
  });

  it('should hide toolbar if enableCodeToolbar becomes false', () => {
    const model = renderToolbar({ activeCellManager: null });
    expect(container.querySelector('.jp-chat-code-toolbar')).not.toBeNull();

    act(() => {
      model.config = { enableCodeToolbar: false };
    });
    expect(container.querySelector('.jp-chat-code-toolbar')).toBeNull();
  });
});
