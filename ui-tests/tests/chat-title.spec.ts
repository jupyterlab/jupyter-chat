/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { Locator } from '@playwright/test';

import { openChat, openChatToSide } from './test-utils';

const FILENAME = 'chat-title.chat';
const TITLE = 'My chat title';

/**
 * Read the metadata of a chat file from disk.
 */
const readMetadata = async (page: IJupyterLabPageFixture): Promise<any> => {
  return page.evaluate(async path => {
    const model = await window.jupyterapp.serviceManager.contents.get(path, {
      content: true,
      type: 'file',
      format: 'text'
    });
    return JSON.parse(model.content).metadata ?? {};
  }, FILENAME);
};

/**
 * Rename the chat by clicking the rename button of a toolbar and filling the
 * dialog.
 */
const renameChat = async (
  page: IJupyterLabPageFixture,
  toolbar: Locator,
  title: string
): Promise<void> => {
  await toolbar.getByTitle('Rename the chat').click();
  const input = page.locator('.jp-Dialog input');
  await expect(input).toBeVisible();
  await input.fill(title);
  await page.locator('.jp-Dialog button.jp-mod-accept').click();
  await expect(page.locator('.jp-Dialog')).not.toBeAttached();
};

test.describe('#chatTitle', () => {
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.contents.uploadContent(
      JSON.stringify({ messages: [], users: {}, metadata: { title: TITLE } }),
      'text',
      FILENAME
    );
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should display the title in the main area toolbar', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    await expect(chatPanel.locator('.jp-Toolbar > .jp-chat-name')).toHaveText(
      TITLE
    );
  });

  test('should display the title in the side panel toolbar', async ({
    page
  }) => {
    const sidePanel = await openChatToSide(page, FILENAME);
    await expect(
      sidePanel.locator('.jp-chat-sidepanel-widget-toolbar > .jp-chat-name')
    ).toHaveText(TITLE);
  });

  test('should update the title from the main area', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const toolbar = chatPanel.locator('.jp-Toolbar', {
      has: page.locator('> .jp-chat-name')
    });
    const name = toolbar.locator('> .jp-chat-name');
    await expect(name).toHaveText(TITLE);

    await renameChat(page, toolbar, 'New title');
    await expect(name).toHaveText('New title');
    await page.waitForCondition(
      async () => (await readMetadata(page)).title === 'New title'
    );

    // An empty title falls back to the file name.
    await renameChat(page, toolbar, '');
    await expect(name).toHaveText('chat-title');
  });

  test('should update the title from the side panel', async ({ page }) => {
    const sidePanel = await openChatToSide(page, FILENAME);
    const toolbar = sidePanel.locator('.jp-chat-sidepanel-widget-toolbar');
    const name = toolbar.locator('> .jp-chat-name');
    await expect(name).toHaveText(TITLE);

    await renameChat(page, toolbar, 'New title');
    await expect(name).toHaveText('New title');
    await page.waitForCondition(
      async () => (await readMetadata(page)).title === 'New title'
    );
  });
});
