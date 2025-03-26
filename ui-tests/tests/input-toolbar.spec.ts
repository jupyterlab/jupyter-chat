/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { PathExt } from '@jupyterlab/coreutils';
import { expect, test } from '@jupyterlab/galata';

import {
  createChat,
  exposeDepsJs,
  getPlugin,
  openChat,
  openChatToSide
} from './test-utils';

const CHAT = 'test.chat';

test.describe('#inputToolbar', () => {
  test('Should remove toolbar item for main area chat', async ({
    page,
    tmpPath
  }) => {
    // Expose a function to get a plugin.
    await page.evaluate(exposeDepsJs({ getPlugin }));

    // Modify the input toolbar when a chat is opened.
    await page.evaluate(async () => {
      const tracker = (
        await window.getPlugin('jupyterlab-chat-extension:factory')
      ).tracker;

      const updateToolbar = registry => {
        registry.removeItem('attach');
      };

      // Should update the input toolbar of main area widgets only
      tracker.widgetAdded.connect((_, widget) => {
        if (widget.context) {
          let registry = widget.context.inputToolbarRegistry;
          if (registry) {
            updateToolbar(registry);
          }
        }
      });
    });

    const chatPath = PathExt.join(tmpPath, CHAT);
    await createChat(page, chatPath);
    const chatPanel = await openChat(page, chatPath);

    // The main area chat input should not contain the 'attach' button.
    const inputToolbar = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-input-toolbar'
    );
    await expect(inputToolbar).toBeVisible();
    await expect(inputToolbar.locator('button')).toHaveCount(2);
    expect(inputToolbar.locator('.jp-chat-attach-button')).not.toBeAttached();

    // The side panel chat input should contain the 'attach' button.
    const chatSidePanel = await openChatToSide(page, chatPath);
    const inputToolbarSide = chatSidePanel.locator(
      '.jp-chat-input-container .jp-chat-input-toolbar'
    );
    await expect(inputToolbarSide).toBeVisible();
    await expect(inputToolbarSide.locator('button')).toHaveCount(3);
    expect(inputToolbarSide.locator('.jp-chat-attach-button')).toBeAttached();
  });
});
