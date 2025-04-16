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

const FILENAME = 'my-chat.chat';

test.use({
  mockUser: USER
});

test.describe('#user-mention', () => {
  test.beforeEach(async ({ page }) => {
    // Create chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should open chat command', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const chatCommandName = page.locator('.jp-chat-command-name');
    await input.press('@');
    await expect(chatCommandName).toHaveCount(1);
    expect(await chatCommandName.nth(0).textContent()).toBe('@jovyan');
  });

  test('should format mention in message', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const sendButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-button'
    );
    const chatCommandName = page.locator('.jp-chat-command-name');
    await input.press('@');
    await chatCommandName.nth(0).click();

    await expect(input).toContainText('@jovyan');
    await sendButton.click();

    const message = chatPanel.locator('.jp-chat-messages-container').nth(0);
    await expect(message).toBeAttached();
    expect(message.locator('.jp-chat-mention')).toBeAttached();
    expect(message.locator('.jp-chat-mention')).toContainText('@jovyan');
  });
});

test.describe('#collaborator-mention', () => {
  let guestPage: IJupyterLabPageFixture;
  test.beforeEach(
    async ({ baseURL, browser, page, tmpPath, waitForApplication }) => {
      // Create chat file
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
        window.galataip.on('dialog', d => {
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

  test('should display collaborators in chat commands', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);

    // Send a message from guest.
    await sendMessage(guestPage, FILENAME, 'test');

    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const chatCommandName = page.locator('.jp-chat-command-name');

    await input.press('@');
    await expect(chatCommandName).toHaveCount(2);
    for (let i = 0; i < (await chatCommandName.count()); i++) {
      expect(['@jovyan', '@jovyan_2']).toContain(
        await chatCommandName.nth(i).textContent()
      );
    }
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
    await expect(chatCommandName).toHaveCount(2);
    for (let i = 0; i < (await chatCommandName.count()); i++) {
      expect(['@jovyan', '@jovyan_2']).toContain(
        await chatCommandName.nth(i).textContent()
      );
    }
  });
});
