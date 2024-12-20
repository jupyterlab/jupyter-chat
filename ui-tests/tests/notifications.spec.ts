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
import { UUID } from '@lumino/coreutils';

import { openChat, openSettings, sendMessage, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.describe('#notifications', () => {
  const baseTime = 1714116341;
  const messagesCount = 15;
  const messagesList: any[] = [];
  for (let i = 0; i < messagesCount; i++) {
    messagesList.push({
      type: 'msg',
      id: UUID.uuid4(),
      sender: USERNAME,
      body: `Message ${i}`,
      time: baseTime + i * 60
    });
  }

  const chatContent = {
    messages: messagesList,
    users: {}
  };
  chatContent.users[USERNAME] = USER.identity;

  let guestPage: IJupyterLabPageFixture;

  test.beforeEach(
    async ({ baseURL, browser, page, tmpPath, waitForApplication }) => {
      // Create a chat file with content
      await page.filebrowser.contents.uploadContent(
        JSON.stringify(chatContent),
        'text',
        FILENAME
      );

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

  test('should receive notification on unread message', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    await messages.first().scrollIntoViewIfNeeded();
    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    await page.waitForCondition(
      async () => (await page.notifications).length > 0
    );
    const notifications = await page.notifications;
    expect(notifications).toHaveLength(1);

    // TODO: fix it, the notification should be info but is 'default'
    // expect(notifications[0].type).toBe('info');
    expect(notifications[0].message).toBe(
      '1 incoming message(s) in my-chat.chat'
    );
  });

  test('should remove notification when the message is read', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    await messages.first().scrollIntoViewIfNeeded();

    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    await page.waitForCondition(
      async () => (await page.notifications).length > 0
    );
    let notifications = await page.notifications;
    expect(notifications).toHaveLength(1);

    await messages.last().scrollIntoViewIfNeeded();
    await page.waitForCondition(
      async () => (await page.notifications).length === 0
    );
  });

  test('should update existing notification on new message', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    await messages.first().scrollIntoViewIfNeeded();

    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    await page.waitForCondition(
      async () => (await page.notifications).length > 0
    );
    let notifications = await page.notifications;
    expect(notifications).toHaveLength(1);

    expect(notifications[0].message).toBe(
      '1 incoming message(s) in my-chat.chat'
    );

    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    notifications = await page.notifications;
    expect(notifications[0].message).toBe(
      '2 incoming message(s) in my-chat.chat'
    );
  });

  test('should remove notifications from settings', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');
    await messages.first().scrollIntoViewIfNeeded();

    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    await page.waitForCondition(
      async () => (await page.notifications).length > 0
    );
    let notifications = await page.notifications;
    expect(notifications).toHaveLength(1);

    const settings = await openSettings(page);
    const unreadNotifications = settings?.getByRole('checkbox', {
      name: 'unreadNotifications'
    });
    await unreadNotifications?.uncheck();

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    // Activate the chat panel
    await page.activity.activateTab(FILENAME);

    await page.waitForCondition(
      async () => (await page.notifications).length === 0
    );

    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    await expect(messages).toHaveCount(messagesCount + 2);

    notifications = await page.notifications;
    expect(notifications).toHaveLength(0);
  });

  test('should add unread symbol in tab label', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');
    await messages.first().scrollIntoViewIfNeeded();

    const tab = page.activity.getTabLocator(FILENAME);
    const tabLabel = tab.locator('.lm-TabBar-tabLabel');
    await expect(tabLabel).toHaveText(FILENAME);

    await sendMessage(guestPage, FILENAME, MSG_CONTENT);
    const beforePseudo = tabLabel.evaluate(elem => {
      return window.getComputedStyle(elem, ':before');
    });
    expect(await beforePseudo).toHaveProperty('content', '"* "');
    expect(await tab.screenshot()).toMatchSnapshot('tab-with-unread.png');

    await messages.last().scrollIntoViewIfNeeded();
    expect(await tab.screenshot()).toMatchSnapshot('tab-without-unread.png');
  });
});
