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

import { openChat, openChatToSide, sendMessage, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.describe('#messagesNavigation', () => {
  const baseTime = 1714116341;
  const messagesList: any[] = [];
  for (let i = 0; i < 15; i++) {
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

  test.describe('navigation without unread message', () => {
    test('should navigate to last message', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const messages = chatPanel.locator('.jp-chat-message');
      const navigationBottom = chatPanel.locator('.jp-chat-navigation-bottom');

      // Move to the first message.
      await messages.first().scrollIntoViewIfNeeded();

      await expect(navigationBottom).toBeAttached();

      // FIXME: This test uses the fact that some messages are marked as read even if
      // they are not displayed, because the unread state is computed before the full
      // rendering of all messages.
      // If the unread state wait for the rendermimeMarkdown, this test should fail
      // because the last messages will be marked as unread.
      expect(navigationBottom).not.toHaveClass(/jp-chat-navigation-unread/);
      expect(await navigationBottom.screenshot()).toMatchSnapshot(
        'navigation-bottom.png'
      );
      await expect(messages.last()).not.toBeInViewport();
      await navigationBottom.click();
      await expect(messages.last()).toBeInViewport();
      await expect(navigationBottom).not.toBeAttached();
    });
  });

  // These tests do not work anymore, since the chat do not scroll to the last message
  // anymore
  test.describe.skip('navigation with previous unread message', () => {
    test.beforeEach(async ({ page }) => {
      const newMessagesList = [...messagesList];
      // Add new message to the document.
      for (let i = 20; i < 50; i++) {
        newMessagesList.push({
          type: 'msg',
          id: UUID.uuid4(),
          sender: USERNAME,
          body: `Message ${i}`,
          time: baseTime + i * 60
        });
      }
      const newChatContent = {
        messages: newMessagesList,
        users: {}
      };
      newChatContent.users[USERNAME] = USER.identity;

      // Create a chat file with content
      await page.filebrowser.contents.uploadContent(
        JSON.stringify(newChatContent),
        'text',
        FILENAME
      );
    });

    test('should have unread icon for previous unread messages', async ({
      page
    }) => {
      const chatPanel = await openChat(page, FILENAME);
      const navigationTop = chatPanel.locator('.jp-chat-navigation-top');

      await expect(navigationTop).toBeAttached();
      expect(navigationTop).toHaveClass(/jp-chat-navigation-unread/);
      expect(await navigationTop.screenshot()).toMatchSnapshot(
        'navigation-top.png'
      );
    });

    test('should navigate to previous unread messages', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const messages = chatPanel.locator('.jp-chat-message');
      const navigationTop = chatPanel.locator('.jp-chat-navigation-top');
      const navigationBottom = chatPanel.locator('.jp-chat-navigation-bottom');

      // Navigate up to the first unread message
      expect(messages.first()).not.toBeInViewport();
      await navigationTop.click();
      expect(messages.first()).toBeInViewport();

      // Navigate down to next unread messages.
      await expect(navigationBottom).toBeAttached();
      await expect(messages.nth(15)).not.toBeInViewport();
      await navigationBottom.click();
      await expect(messages.nth(15)).toBeInViewport();
    });
  });

  test.describe('navigation with new unread message', () => {
    let guestPage: IJupyterLabPageFixture;
    test.beforeEach(
      async ({ baseURL, browser, tmpPath, waitForApplication }) => {
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
    });

    test('should have unread icon for new messages', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const message = chatPanel.locator('.jp-chat-message').first();
      const navigationBottom = chatPanel.locator('.jp-chat-navigation-bottom');
      await message.scrollIntoViewIfNeeded();

      await expect(navigationBottom).toBeAttached();
      expect(navigationBottom).not.toHaveClass(/jp-chat-navigation-unread/);

      await sendMessage(guestPage, FILENAME, MSG_CONTENT);

      await expect(navigationBottom).toHaveClass(/jp-chat-navigation-unread/);
      expect(await navigationBottom.screenshot()).toMatchSnapshot(
        'navigation-bottom-unread.png'
      );
    });

    test('should navigate to new unread message', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const messages = chatPanel.locator('.jp-chat-message');
      const navigationBottom = chatPanel.locator('.jp-chat-navigation-bottom');
      await messages.first().scrollIntoViewIfNeeded();

      await sendMessage(guestPage, FILENAME, MSG_CONTENT);

      await expect(navigationBottom).toHaveClass(/jp-chat-navigation-unread/);
      await navigationBottom.click();
      await expect(messages.last()).toBeInViewport();
      await expect(navigationBottom).not.toBeAttached();
    });
  });
});

test.describe('#localStorage', () => {
  const baseTime = 1714116341;
  const messagesCount = 3;
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

  test('should save last read message in localStorage', async ({ page }) => {
    await openChat(page, FILENAME);

    const hasLocalStorage = async () => {
      const storage = await page.evaluate(() => window.localStorage);
      for (const k in storage) {
        if (k.startsWith('@jupyter/chat:')) {
          return true;
        }
      }
      return false;
    };

    await page.waitForCondition(hasLocalStorage);
    const storage = await page.evaluate(() => window.localStorage);
    let key = '';
    for (const k in storage) {
      if (k.startsWith('@jupyter/chat:')) {
        key = k;
        break;
      }
    }
    const value = JSON.parse(storage[key]);
    expect(value['lastRead']).toBeDefined();
    expect(value['lastRead']).toBe(baseTime + (messagesCount - 1) * 60);
  });
});

test.describe('#markUnread', () => {
  const baseTime = 1714116341;
  const message = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: MSG_CONTENT,
    time: baseTime
  };

  const chatContent = {
    messages: [message],
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
  test.describe('without previous unread message', () => {
    test('button should be disabled in main panel', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Mark chat as read');
      await expect(button).toBeAttached();

      // toBeDisabled() does not work in this case, maybe because it is a jp-button ?
      await expect(button).toHaveAttribute('disabled');
    });

    test('button should be disabled in side panel', async ({ page }) => {
      const sidePanel = await openChatToSide(page, FILENAME);
      const chatTitle = sidePanel
        .locator('.jp-SidePanel-content .jp-AccordionPanel-title')
        .first();
      const button = chatTitle.getByTitle('Mark chat as read');
      await expect(button).toBeAttached();

      // toBeDisabled() does not work in this case, maybe because it is a jp-button ?
      await expect(button).toHaveAttribute('disabled');
    });
  });

  test.describe('with previous unread message', () => {
    test.beforeEach(async ({ page }) => {
      const newMessagesList = [message];
      // Add new messages to the document.
      // We need to add many messages because they are currently marked unread
      // before being fully rendered by the markdownRenderer. Many messages are marked
      // unread even if they are not in the viewport after render.
      for (let i = 1; i < 50; i++) {
        newMessagesList.push({
          type: 'msg',
          id: UUID.uuid4(),
          sender: USERNAME,
          body: `Message ${i}`,
          time: baseTime + i * 60
        });
      }
      const newChatContent = {
        messages: newMessagesList,
        users: {}
      };
      newChatContent.users[USERNAME] = USER.identity;

      // Create a chat file with content
      await page.filebrowser.contents.uploadContent(
        JSON.stringify(newChatContent),
        'text',
        FILENAME
      );
    });

    test('button should be enabled in main panel', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Mark chat as read');
      await expect(button).toBeAttached();
      await expect(button).not.toHaveAttribute('disabled');
    });

    test('should mark as unread in main panel', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Mark chat as read');
      const navigationBottom = chatPanel.locator('.jp-chat-navigation-bottom');

      await expect(button).toBeAttached();
      await expect(navigationBottom).toBeAttached();
      await expect(navigationBottom).toHaveClass(/jp-chat-navigation-unread/);

      await button.click();
      await expect(navigationBottom).not.toHaveClass(
        /jp-chat-navigation-unread/
      );
    });

    test('button should be enabled in side panel', async ({ page }) => {
      const chatPanel = await openChatToSide(page, FILENAME);
      const button = chatPanel.getByTitle('Mark chat as read');
      await expect(button).toBeAttached();
      await expect(button).not.toHaveAttribute('disabled');
    });

    test('should mark as unread in side panel', async ({ page }) => {
      const chatPanel = await openChatToSide(page, FILENAME);
      const button = chatPanel.getByTitle('Mark chat as read');
      const navigationBottom = chatPanel.locator('.jp-chat-navigation-bottom');

      await expect(button).toBeAttached();
      await expect(navigationBottom).toBeAttached();
      await expect(navigationBottom).toHaveClass(/jp-chat-navigation-unread/);

      await button.click();
      await expect(navigationBottom).not.toHaveClass(
        /jp-chat-navigation-unread/
      );
    });
  });
});
