/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test
} from '@jupyterlab/galata';
import { User } from '@jupyterlab/services';

import {
  openChat,
  openSettings,
  sendMessage,
  USER
} from './test-utils';

const FILENAME = 'my-chat.chat';

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
});

test.describe('#typingNotification', () => {
  let guestPage: IJupyterLabPageFixture;
  test.beforeEach(
    async ({ baseURL, browser, page, tmpPath, waitForApplication }) => {
      // Create a chat file
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
    await guestPage.close();
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should display typing user', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const writers = chatPanel.locator('.jp-chat-writers');

    const guestChatPanel = await openChat(guestPage, FILENAME);
    const guestInput = guestChatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');

    await guestInput.press('a');
    await expect(writers).toBeAttached();
    const start = Date.now();
    await expect(writers).toHaveText(/jovyan_2 is writing/);
    await expect(writers).not.toBeAttached();

    // Message should disappear after 1s, but this delay include the awareness update.
    expect(Date.now() - start).toBeLessThanOrEqual(2000);
  });

  test('should display typing user editing a message', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const writers = chatPanel.locator('.jp-chat-writers');

    const guestChatPanel = await openChat(guestPage, FILENAME);

    await sendMessage(guestPage, FILENAME, 'test');
    await expect(writers).not.toBeAttached();
    const message = guestChatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    const messageContent = message.locator('.jp-chat-rendered-markdown');

    // Should display the message toolbar
    await messageContent.hover({ position: { x: 5, y: 5 } });
    await messageContent.locator('.jp-chat-toolbar jp-button').first().click();

    const editInput = guestChatPanel
      .locator('.jp-chat-messages-container .jp-chat-input-container')
      .getByRole('combobox');

    await editInput.focus();

    await editInput.press('a');
    await expect(writers).toBeAttached();
    const start = Date.now();
    await expect(writers).toHaveText(/jovyan_2 is writing/);
    await expect(writers).not.toBeAttached();

    // Message should disappear after 1s, but this delay include the awareness update.
    expect(Date.now() - start).toBeLessThanOrEqual(2000);
  });

  test('should not display typing users if disabled', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const writers = chatPanel.locator('.jp-chat-writers');

    // Modify the guest settings
    const settings = await openSettings(guestPage);
    const sendTypingNotification = settings?.getByRole('checkbox', {
      name: 'sendTypingNotification'
    });
    await sendTypingNotification?.uncheck();
    // wait for the settings to be saved
    await expect(guestPage.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(
      guestPage.activity.getTabLocator('Settings')
    ).not.toHaveAttribute('class', /jp-mod-dirty/);

    const guestChatPanel = await openChat(guestPage, FILENAME);
    const guestInput = guestChatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');

    await guestInput.press('a');

    let visible = true;
    try {
      await page.waitForCondition(() => writers.isVisible(), 3000);
    } catch {
      visible = false;
    }

    if (visible) {
      throw Error('The typing notification should not be attached.');
    }
  });

  test('should display several typing users', async ({
    baseURL,
    browser,
    page,
    tmpPath,
    waitForApplication
  }) => {
    // Create a new user.
    const user3: Partial<User.IUser> = {
      identity: {
        username: 'jovyan_3',
        name: 'jovyan_3',
        display_name: 'jovyan_3',
        initials: 'JP',
        color: 'var(--jp-collaborator-color3)'
      }
    };

    // Create a new page for guest.
    const { page: newPage } = await galata.newPage({
      baseURL: baseURL!,
      browser,
      mockUser: user3,
      tmpPath,
      waitForApplication
    });
    await newPage.evaluate(() => {
      // Acknowledge any dialog
      window.galataip.on('dialog', d => {
        d?.resolve();
      });
    });
    const guestPage2 = newPage;

    const chatPanel = await openChat(page, FILENAME);
    const writers = chatPanel.locator('.jp-chat-writers');

    const guestChatPanel = await openChat(guestPage, FILENAME);
    const guestInput = guestChatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');

    const guest2ChatPanel = await openChat(guestPage2, FILENAME);
    const guest2Input = guest2ChatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');

    await guestInput.press('a');
    await guest2Input.press('a');

    await expect(writers).toBeAttached();
    const regexp = /JP(jovyan_[2|3]) and JP(jovyan_[2|3]) are writing/;
    await expect(writers).toHaveText(regexp);

    const result = regexp.exec((await writers.textContent()) ?? '');
    expect(result?.[1] !== undefined);
    expect(result?.[1] !== result?.[2]);
    await expect(writers).not.toBeAttached();
  });

  test('should display custom typing notification', async ({ page }) => {
    const NOTIFICATION = 'is doing something awesome';
    const chatPanel = await openChat(page, FILENAME);
    const writers = chatPanel.locator('.jp-chat-writers');

    const guestChatPanel = await openChat(guestPage, FILENAME);

    // Update the typing notification for jovyan_2
    await guestPage.evaluate(notification => {
      const chatWidget = window.jupyterapp.shell.currentWidget as any;
      const clientID = chatWidget.model.sharedModel.awareness.clientID;
      chatWidget.model.sharedModel.awareness.states.get(
        clientID
      ).typingIndicator = notification;
    }, NOTIFICATION);

    const guestInput = guestChatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    await guestInput.press('a');

    await expect(writers).toBeAttached();
    const regexp = new RegExp(`jovyan_2 ${NOTIFICATION}`);
    await expect(writers).toHaveText(regexp);
  });
});
