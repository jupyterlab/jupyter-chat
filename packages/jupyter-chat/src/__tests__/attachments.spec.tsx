/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { AttachmentPreviewList } from '../components/attachments';
import { ChatReactContext } from '../context';
import { IAttachment } from '../types';
import { MockChatModel } from './mocks';

describe('AttachmentPreviewList', () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it('renders file attachments and notebook attachments with display names', () => {
    const attachments: IAttachment[] = [
      {
        type: 'file',
        value: 'path/to/data.csv'
      },
      {
        type: 'notebook',
        value: 'analysis.ipynb',
        cells: [
          {
            id: 'cell-1',
            input_type: 'code'
          }
        ]
      }
    ];

    const model = new MockChatModel();
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <AttachmentPreviewList attachments={attachments} />
        </ChatReactContext.Provider>
      );
    });

    expect(container.textContent).toContain('data.csv');
    expect(container.textContent).toContain('analysis.ipynb: code cell');
  });

  it('calls onRemove when remove button is clicked', () => {
    const attachment: IAttachment = {
      type: 'file',
      value: 'test.py'
    };
    const onRemove = jest.fn();

    const model = new MockChatModel();
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <AttachmentPreviewList
            attachments={[attachment]}
            onRemove={onRemove}
          />
        </ChatReactContext.Provider>
      );
    });

    const removeButton = container.querySelector(
      '.jp-chat-attachment-remove button'
    );
    expect(removeButton).not.toBeNull();

    act(() => {
      (removeButton as HTMLButtonElement).click();
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(attachment);
  });

  it('maintains stable DOM elements across re-renders with same attachments', () => {
    const attachments: IAttachment[] = [
      {
        type: 'file',
        value: 'test.py'
      }
    ];

    const model = new MockChatModel();
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <AttachmentPreviewList attachments={attachments} />
        </ChatReactContext.Provider>
      );
    });

    const initialElement = container.querySelector('.jp-chat-attachment');
    expect(initialElement).not.toBeNull();

    // Re-render with same attachment list (simulating typing in input)
    act(() => {
      root.render(
        <ChatReactContext.Provider value={{ model, rmRegistry: {} as any }}>
          <AttachmentPreviewList attachments={[...attachments]} />
        </ChatReactContext.Provider>
      );
    });

    const updatedElement = container.querySelector('.jp-chat-attachment');
    // Because key is stable, React preserves the DOM node instance
    expect(updatedElement).toBe(initialElement);
  });
});

