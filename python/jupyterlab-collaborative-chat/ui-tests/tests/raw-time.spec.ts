/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';
import { UUID } from '@lumino/coreutils';

import { openChat, sendMessage, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
});

test.describe('#raw_time', () => {
  const msg_raw_time = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341,
    raw_time: true
  };
  const msg_verif = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341,
    raw_time: false
  };
  const chatContent = {
    messages: [msg_raw_time, msg_verif],
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

  test('message timestamp should be raw according to file content', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator(
      '.jp-chat-messages-container .jp-chat-message'
    );

    const raw_time = messages.locator('.jp-chat-message-time').first();
    expect(await raw_time.getAttribute('title')).toBe('Unverified time');
    expect(await raw_time.textContent()).toMatch(/\*$/);

    const verified_time = messages.locator('.jp-chat-message-time').last();
    expect(await verified_time.getAttribute('title')).toBe('');
    expect(await verified_time.textContent()).toMatch(/[^\*]$/);
  });

  test('time for new message should not be raw', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator(
      '.jp-chat-messages-container .jp-chat-message'
    );

    // Send a new message
    await sendMessage(page, FILENAME, MSG_CONTENT);

    expect(messages).toHaveCount(3);
    await expect(
      messages.locator('.jp-chat-message-time').last()
    ).toHaveAttribute('title', '');
  });
});
