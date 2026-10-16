/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatSelectorPopup } from '../widgets/chat-selector-popup';

describe('ChatSelectorPopup', () => {
  it('sorts names containing numbers naturally', () => {
    const popup = new ChatSelectorPopup({
      chatNames: ['untitled10', 'untitled2', 'untitled1']
    });

    expect(popup.render().props.names).toEqual([
      'untitled1',
      'untitled2',
      'untitled10'
    ]);
    popup.dispose();
  });
});
