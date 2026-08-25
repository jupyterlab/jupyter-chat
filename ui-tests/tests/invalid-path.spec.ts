/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';
import { webSocketOnly } from './tags';

/**
 * When the server rejects a chat path, it closes the WebSocket. The RTC-free
 * client must handle that gracefully: no loading spinner left hanging, the chat
 * removed, and an error notification shown.
 *
 * A path that escapes the server root is rejected by the server. It cannot be
 * reached through the normal "open a chat file" UI (which validates existence
 * against the ContentsManager first), so the chat is opened directly on the
 * side panel with an unsafe path.
 */
const UNSAFE_PATH = '../../../invalid-chat-path.chat';
const CHAT_PANEL_ID = 'jupyter-chat::multi-chat-panel';

test.describe('#invalid-chat-path', webSocketOnly, () => {
  test('side panel closes the chat and notifies on server rejection', async ({
    page
  }) => {
    await page.evaluate(
      async ({ unsafePath, panelId }) => {
        const app = (window as any).jupyterapp;
        let chatPanel: any = null;
        for (const widget of app.shell.widgets('left')) {
          if (widget.id === panelId) {
            chatPanel = widget;
            break;
          }
        }
        if (!chatPanel) {
          throw new Error('Chat side panel not found');
        }
        app.shell.activateById(chatPanel.id);

        // Build a chat model directly at the unsafe path (bypassing the
        // existence check in the open-chat command) and open it in the panel.
        const factory = app.docRegistry.getModelFactory('chat');
        const model = factory.createNew({});
        model.name = unsafePath;
        model.markDocumentSynced();
        chatPanel.open({ model, displayName: 'invalid-chat' });
      },
      { unsafePath: UNSAFE_PATH, panelId: CHAT_PANEL_ID }
    );

    // An error notification is shown to the user.
    await expect(
      page.getByText(/Unable to open chat at given path/)
    ).toBeVisible();

    // The chat is closed: no loading spinner is left hanging in the panel.
    const chatPanel = page.locator(`[id="${CHAT_PANEL_ID}"]`);
    await expect(chatPanel.locator('.jp-Spinner')).toHaveCount(0);
  });
});
