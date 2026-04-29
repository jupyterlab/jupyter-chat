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

import {
  exposeDepsJs,
  getPlugin,
  openChat,
  openSettings,
  USER
} from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
});

test.describe('#settings', () => {
  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should have chat settings', async ({ page }) => {
    const settings = await openSettings(page, true);
    await expect(
      settings.locator(
        '.jp-PluginList-entry[data-id="jupyterlab-chat-extension:factory"]'
      )
    ).toBeVisible();
  });

  test('should have default settings values', async ({ page }) => {
    const settings = await openSettings(page);
    const sendWithShiftEnter = settings.getByRole('checkbox', {
      name: 'sendWithShiftEnter'
    });
    expect(sendWithShiftEnter).not.toBeChecked();

    const stackMessages = settings.getByRole('checkbox', {
      name: 'stackMessages'
    });
    expect(stackMessages).toBeChecked();

    const showDeleted = settings.getByRole('checkbox', {
      name: 'showDeleted'
    });
    expect(showDeleted).not.toBeChecked();
  });
});

test.describe('#stackedMessages', () => {
  const msg1 = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341
  };
  const msg2 = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: 'Me again',
    time: 1714116341
  };
  const chatContent = {
    messages: [msg1, msg2],
    users: {
      [USERNAME]: USER.identity
    }
  };

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

  test('messages should be stacked by default', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messagesContainer = chatPanel.locator('.jp-chat-messages-container');
    const messages = messagesContainer.locator('.jp-chat-message');
    await expect(messages).toHaveCount(2);

    // Expect the time to be visible only in the first message.
    const times = messages.locator('.jp-chat-message-time');
    await expect(times).toHaveCount(1);
    await expect(times.first()).toBeVisible();

    // Hide the time to avoid time zone diff in screenshot.
    await times.evaluateAll(elements =>
      elements.map(element => (element.style.display = 'none'))
    );

    expect(await messagesContainer.screenshot()).toMatchSnapshot(
      'stacked-messages.png'
    );
  });

  test('should update settings value stackMessages on existing chat', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);

    // Modify the settings
    const settings = await openSettings(page);
    const stackMessages = settings?.getByRole('checkbox', {
      name: 'stackMessages'
    });
    await stackMessages?.uncheck();

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

    // Should not send message with Enter
    const messagesContainer = chatPanel.locator('.jp-chat-messages-container');
    const messages = messagesContainer.locator('.jp-chat-message');
    await expect(messages).toHaveCount(2);

    // Expect the time to be visible only in the first message.
    const times = messages.locator('.jp-chat-message-time');
    await expect(times).toHaveCount(2);
    await expect(times.last()).toBeVisible();

    // Hide the time to avoid time zone diff
    await messages
      .locator('.jp-chat-message-time')
      .evaluateAll(elements =>
        elements.map(element => (element.style.display = 'none'))
      );

    expect(await messagesContainer.screenshot()).toMatchSnapshot(
      'not-stacked-messages.png'
    );
  });
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
    await expect(writers).toHaveText(/jovyan_2 is typing/);

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

    let hasContent = true;
    try {
      await page.waitForCondition(
        async () => !!(await writers.textContent())?.trim(),
        3000
      );
    } catch {
      hasContent = false;
    }

    if (hasContent) {
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
    const regexp = /jovyan_[2|3] and jovyan_[2|3] are typing/;
    await expect(writers).toHaveText(regexp);

    const result = regexp.exec((await writers.textContent()) ?? '');
    expect(result?.[1] !== undefined);
    expect(result?.[1] !== result?.[2]);
  });

  test('should keep new message visible while typing indicator is shown', async ({
    page
  }) => {
    type ChatFileMessage = {
      type: 'msg';
      id: string;
      sender: string;
      body: string;
      time: number;
    };
    type ChatFileContent = {
      messages: ChatFileMessage[];
      users: Record<string, User.IIdentity>;
    };

    const filename = `my-chat-${UUID.uuid4()}.chat`;
    const baseTime = 1714116341;
    const messagesList: ChatFileMessage[] = [];
    for (let i = 0; i < 30; i++) {
      messagesList.push({
        type: 'msg',
        id: UUID.uuid4(),
        sender: USERNAME,
        body: `Message ${i}`,
        time: baseTime + i * 60
      });
    }
    const chatContent: ChatFileContent = {
      messages: messagesList,
      users: {
        [USERNAME]: USER.identity
      }
    };
    await page.filebrowser.contents.uploadContent(
      JSON.stringify(chatContent),
      'text',
      filename
    );

    await page.evaluate(exposeDepsJs({ getPlugin }));

    const chatPanel = await openChat(page, filename);
    const messages = chatPanel.locator('.jp-chat-rendered-message');
    const writers = chatPanel.locator('.jp-chat-writers');
    await expect(messages).toHaveCount(chatContent.messages.length);
    await expect(messages.last()).toBeInViewport();

    const typingUser: User.IIdentity = {
      username: 'jovyan_2',
      name: 'jovyan_2',
      display_name: 'jovyan_2',
      initials: 'JP',
      color: 'var(--jp-collaborator-color2)'
    };

    await page.evaluate(async typingUser => {
      const tracker = await window.getPlugin(
        'jupyterlab-chat-extension:tracker'
      );
      const widget = tracker.currentWidget;
      widget?.model.updateWriters([
        {
          user: typingUser
        }
      ]);
    }, typingUser);
    await expect(writers).toHaveText(/jovyan_2 is typing/);

    const messageCount = await messages.count();
    await page.evaluate(
      async ({
        id,
        body,
        time,
        sender
      }: {
        id: string;
        body: string;
        time: number;
        sender: User.IIdentity;
      }) => {
        const tracker = await window.getPlugin(
          'jupyterlab-chat-extension:tracker'
        );
        const widget = tracker.currentWidget;
        widget?.model.messageAdded({
          type: 'msg',
          id,
          body,
          time,
          sender
        });
      },
      {
        id: UUID.uuid4(),
        body: MSG_CONTENT,
        time: baseTime + 60 * 40,
        sender: typingUser
      }
    );
    await expect(messages).toHaveCount(messageCount + 1);
    await expect(messages.last()).toBeInViewport();
  });
});

test.describe('#showDeletedMessages', () => {
  const msg1 = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: '',
    time: 1714116341,
    deleted: true
  };
  const msg2 = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: 'Message not deleted',
    time: 1714116341
  };
  const chatContent = {
    messages: [msg1, msg2],
    users: {
      [USERNAME]: USER.identity
    }
  };

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

  test('Should toggle the deleted message visibility', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-message');
    await expect(messages).toHaveCount(1);

    /**
     * Checking the checkbox should display the deleted message.
     */
    const settings = await openSettings(page);
    const showDeleted = settings?.getByRole('checkbox', {
      name: 'showDeleted'
    });

    await showDeleted.check();

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    await page.activity.activateTab(FILENAME);
    await expect(messages).toHaveCount(2);

    /**
     * Unchecking the checkbox should hide the deleted message.
     */
    await page.activity.activateTab('Settings');
    await showDeleted.uncheck();

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    await page.activity.activateTab(FILENAME);
    await expect(messages).toHaveCount(1);
  });
});
