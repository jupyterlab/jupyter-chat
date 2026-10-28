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
import { SendButton } from '../components/input/buttons/send-button';
import { ChatReactContext } from '../context';
import { MockChatModel } from './mocks';

function createMockActiveCellManager(available = false): IActiveCellManager {
  return {
    available,
    activeCellError: null,
    availabilityChanged: new Signal({} as any),
    activeCellErrorChanged: new Signal({} as any),
    getContent: () => ({ type: 'code', source: 'a = 1', language: 'python' }),
    insertAbove: jest.fn(),
    insertBelow: jest.fn(),
    replace: jest.fn()
  };
}

describe('SendButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderSendButton = (options?: {
    activeCellManager?: IActiveCellManager | null;
    value?: string;
  }): MockChatModel => {
    const model = new MockChatModel({
      activeCellManager: options?.activeCellManager ?? null,
      config: { sendWithSelection: true }
    });
    if (options?.value) {
      model.input.value = options.value;
    }
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <SendButton model={model.input} chatModel={model} />
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

  it('should disable both send and dropdown opener when input is empty and no selection', () => {
    const activeCellManager = createMockActiveCellManager(false);
    renderSendButton({ activeCellManager, value: '' });

    const sendBtn = container.querySelector(
      '.jp-chat-send-button'
    ) as HTMLButtonElement;
    const openerBtn = container.querySelector(
      '.jp-chat-send-include-opener'
    ) as HTMLButtonElement;

    expect(sendBtn).not.toBeNull();
    expect(openerBtn).not.toBeNull();
    expect(sendBtn.disabled).toBe(true);
    expect(openerBtn.disabled).toBe(true);
  });

  it('should enable dropdown opener when active cell is available even if input is empty', () => {
    const activeCellManager = createMockActiveCellManager(true);
    renderSendButton({ activeCellManager, value: '' });

    const sendBtn = container.querySelector(
      '.jp-chat-send-button'
    ) as HTMLButtonElement;
    const openerBtn = container.querySelector(
      '.jp-chat-send-include-opener'
    ) as HTMLButtonElement;

    expect(sendBtn).not.toBeNull();
    expect(openerBtn).not.toBeNull();
    expect(sendBtn.disabled).toBe(true);
    expect(openerBtn.disabled).toBe(false);
  });

  it('should enable send button when input has text', () => {
    const activeCellManager = createMockActiveCellManager(false);
    renderSendButton({ activeCellManager, value: 'Hello' });

    const sendBtn = container.querySelector(
      '.jp-chat-send-button'
    ) as HTMLButtonElement;
    const openerBtn = container.querySelector(
      '.jp-chat-send-include-opener'
    ) as HTMLButtonElement;

    expect(sendBtn.disabled).toBe(false);
    expect(openerBtn.disabled).toBe(false);
  });
});
