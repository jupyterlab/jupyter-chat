/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';
import {
  openChat,
  openChatToSide,
  openSidePanel,
  sendMessage
} from './test-utils';

const CHAT1 = 'test1.chat';
const CHAT2 = 'test2.chat';
const OVERFLOW_CHAT = 'overflow.chat';

test.describe('#messageOverflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.contents.uploadContent('{}', 'text', OVERFLOW_CHAT);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(OVERFLOW_CHAT)) {
      await page.filebrowser.contents.deleteFile(OVERFLOW_CHAT);
    }
  });

  test('should not overflow the messages container', async ({ page }) => {
    const longLine = 'x'.repeat(100);
    const chatPanel = await openChat(page, OVERFLOW_CHAT);
    await sendMessage(page, OVERFLOW_CHAT, `\`${longLine}\``);

    const messagesContainer = chatPanel.locator('.jp-chat-messages-container');
    await expect(
      messagesContainer.locator('.jp-chat-rendered-message')
    ).toHaveCount(1);

    const containerOverflows = await messagesContainer.evaluate(
      el => el.scrollWidth > el.clientWidth
    );
    expect(containerOverflows).toBe(false);

    const renderedMessage = messagesContainer
      .locator('.jp-chat-rendered-message')
      .first();
    const messageOverflows = await renderedMessage.evaluate(
      el => el.scrollWidth > el.clientWidth
    );
    expect(messageOverflows).toBe(true);
  });
});

test.describe('#restorer', () => {
  test.beforeEach(async ({ page }) => {
    // Create chat filed
    await page.filebrowser.contents.uploadContent('{}', 'text', CHAT1);
    await page.filebrowser.contents.uploadContent('{}', 'text', CHAT2);
  });

  test.afterEach(async ({ page }) => {
    [CHAT1, CHAT2].forEach(async file => {
      if (await page.filebrowser.contents.fileExists(file)) {
        await page.filebrowser.contents.deleteFile(file);
      }
    });
  });

  test('should restore the previous session', async ({ page }) => {
    const chat1 = await openChat(page, CHAT1);
    const chat2 = await openChatToSide(page, CHAT2);
    await page.reload({ waitForIsReady: false });

    await expect(chat1).toBeVisible();
    // open the side panel if it is not
    await openSidePanel(page);
    await expect(chat2).toBeVisible();
  });
});
