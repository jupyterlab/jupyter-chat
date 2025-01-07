/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';
import { openChat, openChatToSide, openSidePanel } from './test-utils';

const CHAT1 = 'test1.chat';
const CHAT2 = 'test2.chat';

test.describe('#restorer', () => {
  test.beforeEach(async ({ page }) => {
    // Create chat filed
    await page.filebrowser.contents.uploadContent('{}', 'text', CHAT1);
    await page.filebrowser.contents.uploadContent('{}', 'text', CHAT2);
  });

  test.afterEach(async ({ page }) => {
    [CHAT1, CHAT2].forEach(async (file) => {
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