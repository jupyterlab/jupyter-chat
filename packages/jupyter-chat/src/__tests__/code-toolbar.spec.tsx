/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { CodeToolbar } from '../components/code-blocks/code-toolbar';
import { IConfig } from '../types';
import { MockChatModel } from './mocks';

describe('CodeToolbar without an active cell manager', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (config?: IConfig): void => {
    const model = new MockChatModel({ config });
    act(() => {
      root.render(<CodeToolbar model={model} content={'print(1)'} />);
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

  it('should keep the copy button available', () => {
    render();

    const toolbar = container.querySelector('.jp-chat-code-toolbar');
    expect(toolbar).not.toBeNull();
    expect(
      toolbar!.querySelector('button[aria-label="Copy to clipboard"]')
    ).not.toBeNull();
    // The insert and replace actions cannot target a cell, so they are not
    // offered at all.
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('should render nothing when the toolbar is disabled', () => {
    render({ enableCodeToolbar: false });

    expect(container.querySelector('.jp-chat-code-toolbar')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
