/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';
import { UUID } from '@lumino/coreutils';

import { openChat, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
});

test.describe('#messageToolbar', () => {
  const msg = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341
  };
  const chatContent = {
    messages: [msg],
    users: {}
  };
  chatContent.users[USERNAME] = USER.identity;

  test.beforeEach(async ({ page }) => {
    // Create a chat file with content
    await page.filebrowser.contents.uploadContent(
      JSON.stringify(chatContent),
      'text',
      FILENAME
    );
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('message should have a toolbar', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendered-markdown')
      .first();

    await expect(message.locator('.jp-chat-toolbar')).not.toBeVisible();

    //Should display the message toolbar
    await message.hover({ position: { x: 5, y: 5 } });
    await expect(message.locator('.jp-chat-toolbar')).toBeVisible();
  });

  test('should set the message as deleted', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    const messageContent = message.locator('.jp-chat-rendered-markdown');

    // Should display the message toolbar
    await messageContent.hover({ position: { x: 5, y: 5 } });
    await messageContent.locator('.jp-chat-toolbar button').last().click();

    await expect(messageContent).not.toBeVisible();
  });
});
