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

import { openChat, sendMessage, USER } from './test-utils';

const FILENAME = 'autoscroll-test.chat';
const USERNAME = USER.identity.username;

test.describe('#autoscroll', () => {
  const baseTime = 1714116341;
  const messagesList: any[] = [];
  for (let i = 0; i < 20; i++) {
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
      await page.filebrowser.contents.uploadContent(
        JSON.stringify(chatContent),
        'text',
        FILENAME
      );

      const user2: Partial<User.IUser> = {
        identity: {
          username: 'jovyan_2',
          name: 'jovyan_2',
          display_name: 'jovyan_2',
          initials: 'JP',
          color: 'var(--jp-collaborator-color2)'
        }
      };

      const { page: newPage } = await galata.newPage({
        baseURL: baseURL!,
        browser,
        mockUser: user2,
        tmpPath,
        waitForApplication
      });
      await newPage.evaluate(() => {
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

  test('should start scrolled to the bottom', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    await expect(messages.last()).toBeInViewport();
  });

  test('should auto-scroll when new message arrives and user is at bottom', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    // Verify we start at the bottom
    await expect(messages.last()).toBeInViewport();

    // Send a new message from the guest
    await sendMessage(guestPage, FILENAME, 'New message from guest');

    // Wait for the new message to appear and verify it's in viewport
    const newMessage = chatPanel.locator('.jp-chat-message').last();
    await expect(newMessage).toBeInViewport();
  });

  test('should not scroll when new message arrives and user has scrolled up', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    // Scroll to the first message (user scrolls up)
    await messages.first().scrollIntoViewIfNeeded();
    await expect(messages.last()).not.toBeInViewport();

    // Send a new message from the guest
    await sendMessage(guestPage, FILENAME, 'New message while scrolled up');

    // Wait for the message to be added
    await expect(
      chatPanel.locator('.jp-chat-message').last()
    ).toContainText('New message while scrolled up');

    // The first message should still be visible (viewport didn't move)
    await expect(messages.first()).toBeInViewport();
    // The new last message should not be visible
    await expect(chatPanel.locator('.jp-chat-message').last()).not.toBeInViewport();
  });

  test('should re-engage auto-scroll when user scrolls back to bottom', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME, chatContent);
    const messages = chatPanel.locator('.jp-chat-message');

    // Scroll up to disengage auto-scroll
    await messages.first().scrollIntoViewIfNeeded();
    await expect(messages.last()).not.toBeInViewport();

    // Scroll back to the bottom to re-engage
    await messages.last().scrollIntoViewIfNeeded();
    await expect(messages.last()).toBeInViewport();

    // Send a new message — should auto-scroll to show it
    await sendMessage(guestPage, FILENAME, 'Message after re-engage');

    const newMessage = chatPanel.locator('.jp-chat-message').last();
    await expect(newMessage).toContainText('Message after re-engage');
    await expect(newMessage).toBeInViewport();
  });
});
