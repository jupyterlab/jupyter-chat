/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  expect,
  galata,
  IJupyterLabPageFixture,
  test
} from '@jupyterlab/galata';
import { User } from '@jupyterlab/services';
import { openChat, sendMessage, USER } from './test-utils';

const FILENAME = 'user-mention.chat';

test.use({
  mockUser: USER
});

test.describe('#user-mention', () => {
  let guestPage: IJupyterLabPageFixture;
  test.beforeEach(
    async ({ baseURL, browser, page, tmpPath, waitForApplication }) => {
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
      // Create a new user.
      const user2: Partial<User.IUser> = {
        identity: {
          username: 'jovyan_2',
          name: 'jovyan_2',
          display_name: 'jovyan_2',
          initials: 'JP',
          color: 'var(--jp-collaborator-color2)'
        }
      };

      // Create a new page for guest.
      const { page: newPage } = await galata.newPage({
        baseURL: baseURL!,
        browser,
        mockUser: user2,
        tmpPath,
        waitForApplication
      });
      await newPage.evaluate(() => {
        // Acknowledge any dialog
        window.galata.on('dialog', d => {
          d?.resolve();
        });
      });
      guestPage = newPage;
    }
  );

  test.afterEach(async ({ page }) => {
    guestPage.close();
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should open chat command with guest user', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);

    // Send a message from guest to make sure users are populated
    await sendMessage(guestPage, FILENAME, 'Hello from guest');

    // Check mentions on main page
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const chatCommandName = page.locator('.jp-chat-command-name');
    await input.press('@');
    await expect(chatCommandName).toHaveCount(1);
    expect(await chatCommandName.nth(0).textContent()).toBe('@jovyan_2');
  });

  test('should format mention in message', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);

    // Send a message from guest.
    await sendMessage(guestPage, FILENAME, 'test');

    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const sendButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-button'
    );
    const chatCommandName = page.locator('.jp-chat-command-name');

    await input.press('@');
    await chatCommandName.nth(0).click();

    await expect(input).toContainText('@jovyan_2');
    await sendButton.click();

    const message = chatPanel.locator('.jp-chat-messages-container').nth(0);
    await expect(message).toBeAttached();
    expect(message.locator('.jp-chat-mention')).toBeAttached();
    expect(message.locator('.jp-chat-mention')).toContainText('@jovyan_2');
  });

  test('should not be case sensitive', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);

    // Send a message from guest.
    await sendMessage(guestPage, FILENAME, 'test');

    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const chatCommandName = page.locator('.jp-chat-command-name');

    await input.pressSequentially('@JO');
    await expect(chatCommandName).toHaveCount(1);
    expect(await chatCommandName.nth(0).textContent()).toBe('@jovyan_2');
  });
});

test.describe('#bot-mention', () => {
  const BOT_FILENAME = 'bot-mention.chat';
  // A chat whose user list already contains a human and a bot (the shape AI
  // personas write): only the human should be mentionable. Each has sent a
  // message, so both are populated as chat users.
  const CONTENT = JSON.stringify({
    messages: [
      {
        id: '4dd34eee-9e9f-4b0a-9c44-9962c8de4f95',
        type: 'msg',
        body: 'hi from human',
        sender: 'human_user',
        time: 1700000000,
        raw_time: false
      },
      {
        id: '9a4b7c88-2f6e-4d15-a30f-4a5bc1af1d21',
        type: 'msg',
        body: 'hi from bot',
        sender: 'bot_user',
        time: 1700000001,
        raw_time: false
      }
    ],
    users: {
      human_user: {
        username: 'human_user',
        name: 'human_user',
        display_name: 'human_user'
      },
      bot_user: {
        username: 'bot_user',
        name: 'Bot Agent',
        display_name: 'Bot-Agent',
        bot: true
      }
    },
    attachments: {},
    metadata: {}
  });

  test.use({
    mockUser: USER
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.contents.uploadContent(
      CONTENT,
      'text',
      BOT_FILENAME
    );
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(BOT_FILENAME)) {
      await page.filebrowser.contents.deleteFile(BOT_FILENAME);
    }
  });

  test('should not suggest bot users', async ({ page }) => {
    const chatPanel = await openChat(page, BOT_FILENAME);

    // Wait for the seeded messages to render, so the user list is loaded
    // before querying completions.
    await expect(chatPanel.locator('.jp-chat-message')).toHaveCount(2);

    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const chatCommandName = page.locator('.jp-chat-command-name');

    await input.fill('');
    await input.press('@');
    await expect(chatCommandName).toHaveCount(1);
    expect(await chatCommandName.nth(0).textContent()).toBe('@human_user');
  });

  test('should not attach a mention for a typed bot name', async ({ page }) => {
    const chatPanel = await openChat(page, BOT_FILENAME);

    // Wait for the seeded messages to render, so the user list is loaded
    // before submitting (mentions resolve on submit).
    await expect(chatPanel.locator('.jp-chat-message')).toHaveCount(2);

    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const sendButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-button'
    );

    await input.fill('');
    await input.pressSequentially('hi @Bot-Agent');
    await sendButton.click();

    const message = chatPanel.locator('.jp-chat-message').last();
    await expect(message).toContainText('hi @Bot-Agent');
    await expect(message.locator('.jp-chat-mention')).toHaveCount(0);
  });
});
