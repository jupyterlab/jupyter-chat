/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';

import { openSidePanel } from './test-utils';

const CHAT_NAME = 'placeholder';
const FILENAME = `${CHAT_NAME}.chat`;

// The chat list is populated from the chats in `defaultDirectory`. The UI tests
// share a single Jupyter server across parallel workers, so using the (shared)
// root directory would let chat files created by other test files leak into the
// counts asserted here. Scoping this suite to its own directory keeps the chat
// list deterministic. See https://github.com/jupyterlab/jupyter-chat/issues/471.
const CHAT_DIR = 'placeholder-chats';

test.use({
  mockSettings: {
    ...galata.DEFAULT_SETTINGS,
    'jupyterlab-chat-extension:factory': {
      defaultDirectory: CHAT_DIR
    }
  }
});

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
    const CHAT_PATH = `${CHAT_DIR}/${FILENAME}`;

    test.beforeEach(async ({ page }) => {
      await page.filebrowser.contents.uploadContent('{}', 'text', CHAT_PATH);
    });

    test.afterEach(async ({ page }) => {
      if (await page.filebrowser.contents.directoryExists(CHAT_DIR)) {
        await page.filebrowser.contents.deleteDirectory(CHAT_DIR);
      }
    });

    test('should list an existing chat file', async ({ page }) => {
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(CHAT_PATH)
      );

      const panel = await openSidePanel(page);
      const item = panel.getByRole('button', { name: CHAT_NAME });
      await expect(item).toHaveCount(1);
    });

    test('should list multiple chat files sorted alphabetically', async ({
      page
    }) => {
      const files = ['charlie.chat', 'alpha.chat', 'bravo.chat'];
      for (const file of files) {
        await page.filebrowser.contents.uploadContent(
          '{}',
          'text',
          `${CHAT_DIR}/${file}`
        );
      }
      await page.waitForCondition(async () => {
        if (!(await page.filebrowser.contents.fileExists(CHAT_PATH))) {
          return false;
        }
        for (const file of files) {
          if (
            !(await page.filebrowser.contents.fileExists(`${CHAT_DIR}/${file}`))
          ) {
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
    });

    test('should open a chat when clicking its name in the list', async ({
      page
    }) => {
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(CHAT_PATH)
      );

      const panel = await openSidePanel(page);
      await panel.getByRole('button', { name: CHAT_NAME }).first().click();

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
        async () => await page.filebrowser.contents.fileExists(CHAT_PATH)
      );

      const panel = await openSidePanel(page);
      await panel.getByRole('button', { name: CHAT_NAME }).first().click();

      await expect(panel.locator('.jp-chat-placeholder')).not.toBeAttached();
    });
  });

  test.describe('#dynamicUpdate', () => {
    const CHAT_PATH = `${CHAT_DIR}/${FILENAME}`;

    test.beforeEach(async ({ page }) => {
      // Ensure the (isolated) default directory exists but is empty.
      if (!(await page.filebrowser.contents.directoryExists(CHAT_DIR))) {
        await page.filebrowser.contents.createDirectory(CHAT_DIR);
      }
    });

    test.afterEach(async ({ page }) => {
      if (await page.filebrowser.contents.directoryExists(CHAT_DIR)) {
        await page.filebrowser.contents.deleteDirectory(CHAT_DIR);
      }
    });

    test('should update the list when a chat file is created or deleted', async ({
      page
    }) => {
      const panel = await openSidePanel(page);
      const items = panel.getByRole('button', { name: CHAT_NAME });

      // No chat initially.
      await expect(items).toHaveCount(0);

      // Create a chat file and expect the list to update.
      await page.filebrowser.contents.uploadContent('{}', 'text', CHAT_PATH);
      await expect(items).toHaveCount(1);
      await expect(items.first()).toHaveText(CHAT_NAME);

      // Delete the file and expect the list to update.
      await page.filebrowser.contents.deleteFile(CHAT_PATH);
      await expect(items).toHaveCount(0);
    });
  });
});
