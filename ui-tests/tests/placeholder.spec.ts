/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';

import { openSidePanel } from './test-utils';

const CHAT_NAME = 'my-chat';
const FILENAME = `${CHAT_NAME}.chat`;

test.describe('#placeholder', () => {
  test.describe('#initialization', () => {
    test('should show the placeholder when no chat is opened', async ({
      page
    }) => {
      const panel = await openSidePanel(page);
      const placeholder = panel.locator('.jp-chat-placeholder');
      await expect(placeholder).toBeVisible();
    });

    test('should show the hint to create a new chat', async ({ page }) => {
      const panel = await openSidePanel(page);
      const hint = panel.locator('.jp-chat-placeholder-hint');
      await expect(hint).toBeVisible();
    });

    test('should show no chat list when no chat file exists', async ({
      page
    }) => {
      const panel = await openSidePanel(page);
      const items = panel.locator('.jp-chat-placeholder-chat-item');
      await expect(items).toHaveCount(0);
    });
  });

  test.describe('#chatList', () => {
    test.beforeEach(async ({ page }) => {
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
    });

    test.afterEach(async ({ page }) => {
      if (await page.filebrowser.contents.fileExists(FILENAME)) {
        await page.filebrowser.contents.deleteFile(FILENAME);
      }
    });

    test('should list an existing chat file', async ({ page }) => {
      await page.waitForCondition(
        async () =>
          await page.filebrowser.contents.fileExists(FILENAME)
      );

      const panel = await openSidePanel(page);
      const items = panel.locator('.jp-chat-placeholder-chat-item');
      await expect(items).toHaveCount(1);
      await expect(items.first()).toHaveText(CHAT_NAME);
    });

    test('should list multiple chat files sorted alphabetically', async ({
      page
    }) => {
      const files = ['charlie.chat', 'alpha.chat', 'bravo.chat'];
      for (const file of files) {
        await page.filebrowser.contents.uploadContent('{}', 'text', file);
      }
      await page.waitForCondition(async () => {
        for (const file of files) {
          if (!(await page.filebrowser.contents.fileExists(file))) {
            return false;
          }
        }
        return true;
      });

      const panel = await openSidePanel(page);
      const items = panel.locator('.jp-chat-placeholder-chat-item');
      await expect(items).toHaveCount(4);
      await expect(items.nth(0)).toHaveText('alpha');
      await expect(items.nth(1)).toHaveText('bravo');
      await expect(items.nth(2)).toHaveText('charlie');
      await expect(items.nth(3)).toHaveText(CHAT_NAME);

      for (const file of files) {
        await page.filebrowser.contents.deleteFile(file);
      }
    });

    test('should open a chat when clicking its name in the list', async ({
      page
    }) => {
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(FILENAME)
      );

      const panel = await openSidePanel(page);
      await panel.locator('.jp-chat-placeholder-chat-item').first().click();

      const chatToolbar = panel.locator(
        '.jp-chat-sidepanel-widget .jp-chat-sidepanel-widget-toolbar'
      );
      await expect(chatToolbar).toBeVisible();
      await expect(
        chatToolbar.locator('.jp-chat-sidepanel-widget-title')
      ).toHaveText(CHAT_NAME);
    });

    test('should hide the placeholder after opening a chat', async ({
      page
    }) => {
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(FILENAME)
      );

      const panel = await openSidePanel(page);
      await panel.locator('.jp-chat-placeholder-chat-item').first().click();

      await expect(panel.locator('.jp-chat-placeholder')).not.toBeAttached();
    });
  });

  test.describe('#dynamicUpdate', () => {
    test.afterEach(async ({ page }) => {
      if (await page.filebrowser.contents.fileExists(FILENAME)) {
        await page.filebrowser.contents.deleteFile(FILENAME);
      }
    });

    test('should update the list when a chat file is created or deleted', async ({
      page
    }) => {
      const panel = await openSidePanel(page);
      const items = panel.locator('.jp-chat-placeholder-chat-item');

      // No chat initially.
      await expect(items).toHaveCount(0);

      // Create a chat file and expect the list to update.
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
      await expect(items).toHaveCount(1);
      await expect(items.first()).toHaveText(CHAT_NAME);

      // Delete the file and expect the list to update.
      await page.filebrowser.contents.deleteFile(FILENAME);
      await expect(items).toHaveCount(0);
    });
  });
});
