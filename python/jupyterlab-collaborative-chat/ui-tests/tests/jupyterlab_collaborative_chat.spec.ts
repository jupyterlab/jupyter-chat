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
import { Contents, User } from '@jupyterlab/services';
import { ReadonlyJSONObject, UUID } from '@lumino/coreutils';
import { Locator } from '@playwright/test';

import { openChat, sendMessage, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
});

const fillModal = async (
  page: IJupyterLabPageFixture,
  text = '',
  button: 'Ok' | 'Cancel' = 'Ok'
): Promise<void> => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').pressSequentially(text);
  await dialog.getByRole('button').filter({ hasText: button }).click();
};

const readFileContent = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<Contents.IModel> => {
  return await page.evaluate(async filepath => {
    return await window.jupyterapp.serviceManager.contents.get(filepath);
  }, filename);
};

const openChatToSide = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<Locator> => {
  const panel = page.locator('.jp-SidePanel.jp-collab-chat-sidepanel');
  await page.evaluate(async filepath => {
    const inSidePanel = true;
    await window.jupyterapp.commands.execute('collaborative-chat:open', {
      filepath,
      inSidePanel
    });
  }, filename);
  await expect(panel).toBeVisible();
  return panel;
};

const openSettings = async (
  page: IJupyterLabPageFixture,
  globalSettings?: boolean
): Promise<Locator> => {
  const args = globalSettings ? {} : { query: 'Chat' };
  await page.evaluate(async args => {
    await window.jupyterapp.commands.execute('settingeditor:open', args);
  }, args);

  // Activate the settings tab, sometimes it does not automatically.
  const settingsTab = page
    .getByRole('main')
    .getByRole('tab', { name: 'Settings', exact: true });
  await settingsTab.click();
  await page.waitForCondition(
    async () => (await settingsTab.getAttribute('aria-selected')) === 'true'
  );
  return (await page.activity.getPanelLocator('Settings')) as Locator;
};

const openSidePanel = async (
  page: IJupyterLabPageFixture
): Promise<Locator> => {
  const panel = page.locator('.jp-SidePanel.jp-collab-chat-sidepanel');

  if (!(await panel?.isVisible())) {
    const chatIcon = page.getByTitle('Jupyter Chat');
    await chatIcon.click();
    await expect(panel).toBeVisible();
  }
  return panel.first();
};

test.describe('#commandPalette', () => {
  const name = FILENAME.replace('.chat', '');

  test.beforeEach(async ({ page }) => {
    await page.keyboard.press('Control+Shift+c');
  });

  test.afterEach(async ({ page }) => {
    for (let filename of ['untitled.chat', FILENAME]) {
      if (await page.filebrowser.contents.fileExists(filename)) {
        await page.filebrowser.contents.deleteFile(filename);
      }
    }
  });

  test('should have 2 commands in palette', async ({ page }) => {
    await expect(
      page.locator(
        '#modal-command-palette li[data-command^="collaborative-chat"]'
      )
    ).toHaveCount(2);
  });

  test('should create a chat with name from command palette', async ({
    page
  }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:create"]'
      )
      .click();
    await fillModal(page, name);
    await page.waitForCondition(
      async () => await page.filebrowser.contents.fileExists(FILENAME)
    );
    await expect(page.activity.getTabLocator(FILENAME)).toBeVisible();
  });

  test('should create an untitled chat from command palette', async ({
    page
  }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:create"]'
      )
      .click();
    await fillModal(page);
    await page.waitForCondition(
      async () => await page.filebrowser.contents.fileExists('untitled.chat')
    );
    await expect(page.activity.getTabLocator('untitled.chat')).toBeVisible();
  });

  test('should not create a chat if modal is cancelled', async ({ page }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:create"]'
      )
      .click();
    await fillModal(page, '', 'Cancel');
    const tab = page.getByRole('main').getByRole('tab');
    await expect(tab).toHaveCount(1);
  });

  test('should open an existing chat', async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);

    // open it from command palette
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:open"]'
      )
      .click();
    await fillModal(page, FILENAME);
    await expect(page.activity.getTabLocator(FILENAME)).toBeVisible();
  });
});

test.describe('#menuNew', () => {
  test('should have an entry in main menu -> new', async ({ page }) => {
    const menu = await page.menu.openLocator('File>New');
    // Snapshot on list the list to avoid the menu border with transparency,
    // which can lead to error due to background.
    expect(await menu!.locator('> ul').screenshot()).toMatchSnapshot(
      'menu-new.png'
    );
  });

  test('should open modal create from the menu', async ({ page }) => {
    await page.menu.clickMenuItem('File>New>Chat');
    await expect(page.locator('dialog .jp-Dialog-header')).toHaveText(
      'Create a new chat'
    );
  });
});

test.describe('#launcher', () => {
  test('should have a launcher item in section', async ({ page }) => {
    // Chat section
    await expect(
      page.locator('.jp-Launcher-sectionTitle:text("Chat")')
    ).toHaveCount(1);

    // Chat tile
    const tile = page.locator('.jp-LauncherCard[data-category="Chat"]');
    expect(await tile.screenshot()).toMatchSnapshot('launcher-tile.png');
  });

  test('should open modal create from the launcher', async ({ page }) => {
    await page.locator('.jp-LauncherCard').getByTitle('Create a chat').click();
    await expect(page.locator('dialog .jp-Dialog-header')).toHaveText(
      'Create a new chat'
    );
  });
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
        '.jp-PluginList-entry[data-id="jupyterlab-collaborative-chat:factory"]'
      )
    ).toBeVisible();
  });

  test('should have default settings values', async ({ page }) => {
    const settings = await openSettings(page);
    const sendWithShiftEnter = settings?.getByRole('checkbox', {
      name: 'sendWithShiftEnter'
    });
    expect(sendWithShiftEnter!).not.toBeChecked();

    const stackMessages = settings?.getByRole('checkbox', {
      name: 'stackMessages'
    });
    expect(stackMessages!).toBeChecked();
  });
});

test.describe('#sendMessages', () => {
  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should send a message using button', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const sendButton = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('button');
    await input.pressSequentially(MSG_CONTENT);
    await sendButton.click();

    const messages = chatPanel.locator('.jp-chat-messages-container');
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    // It seems that the markdown renderer adds a new line.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(MSG_CONTENT + '\n');
  });

  test('should send a message using keyboard', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    await input.pressSequentially(MSG_CONTENT);
    await input.press('Enter');

    const messages = chatPanel.locator('.jp-chat-messages-container');
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    // It seems that the markdown renderer adds a new line.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(MSG_CONTENT + '\n');
  });

  test('should use settings value sendWithShiftEnter', async ({ page }) => {
    // Modify the settings
    const settings = await openSettings(page);
    const sendWithShiftEnter = settings?.getByRole('checkbox', {
      name: 'sendWithShiftEnter'
    });
    await sendWithShiftEnter?.check();

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    // Should not send message with Enter
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    await input!.pressSequentially(MSG_CONTENT);
    await input!.press('Enter');

    await expect(messages!.locator('.jp-chat-message')).toHaveCount(0);

    // Should not send message with Shift+Enter
    await input!.press('Shift+Enter');
    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    // It seems that the markdown renderer adds a new line, but the '\n' inserter when
    // pressing Enter above is trimmed.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(MSG_CONTENT + '\n');
  });

  test('should update settings value sendWithShiftEnter on existing chat', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);

    // Modify the settings
    const settings = await openSettings(page);
    const sendWithShiftEnter = settings?.getByRole('checkbox', {
      name: 'sendWithShiftEnter'
    });
    await sendWithShiftEnter?.check();

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
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    await input!.pressSequentially(MSG_CONTENT);
    await input!.press('Enter');

    await expect(messages!.locator('.jp-chat-message')).toHaveCount(0);

    // Should not send message with Shift+Enter
    await input!.press('Shift+Enter');
    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    // It seems that the markdown renderer adds a new line, but the '\n' inserted when
    // pressing Enter above is trimmed.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(MSG_CONTENT + '\n');
  });
});

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
    const chatPanel = await openChat(page, FILENAME);
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
    const chatPanel = await openChat(page, FILENAME);
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
    const chatPanel = await openChat(page, FILENAME);
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
    const chatPanel = await openChat(page, FILENAME);
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
    const chatPanel = await openChat(page, FILENAME);
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

test.describe('#messageToolbar', () => {
  const additionnalContent = ' Messages can be edited';

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
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();

    await expect(message.locator('.jp-chat-toolbar')).not.toBeVisible();

    //Should display the message toolbar
    await message.hover({ position: { x: 5, y: 5 } });
    await expect(message.locator('.jp-chat-toolbar')).toBeVisible();
  });

  test('should update the message', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    const messageContent = message.locator('.jp-chat-rendermime-markdown');

    // Should display the message toolbar
    await messageContent.hover({ position: { x: 5, y: 5 } });
    await messageContent.locator('.jp-chat-toolbar jp-button').first().click();

    await expect(messageContent).not.toBeVisible();

    const editInput = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-input-container')
      .getByRole('combobox');

    await expect(editInput).toBeVisible();
    await editInput.focus();
    await editInput.press('End');
    await editInput.pressSequentially(additionnalContent);
    await editInput.press('Enter');

    // It seems that the markdown renderer adds a new line.
    await expect(messageContent).toHaveText(
      MSG_CONTENT + additionnalContent + '\n'
    );
    expect(
      await message.locator('.jp-chat-message-header').textContent()
    ).toContain('(edited)');
  });

  test('should cancel message edition', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    const messageContent = message.locator('.jp-chat-rendermime-markdown');

    // Should display the message toolbar
    await messageContent.hover({ position: { x: 5, y: 5 } });
    await messageContent.locator('.jp-chat-toolbar jp-button').first().click();

    await expect(messageContent).not.toBeVisible();

    const editInput = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-input-container')
      .getByRole('combobox');

    await expect(editInput).toBeVisible();
    await editInput.focus();
    await editInput.press('End');
    await editInput.pressSequentially(additionnalContent);

    const cancelButton = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-input-container')
      .getByTitle('Cancel edition');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await expect(editInput).not.toBeVisible();

    // It seems that the markdown renderer adds a new line.
    await expect(messageContent).toHaveText(MSG_CONTENT + '\n');
    expect(
      await message.locator('.jp-chat-message-header').textContent()
    ).not.toContain('(edited)');
  });

  test('should set the message as deleted', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    const messageContent = message.locator('.jp-chat-rendermime-markdown');

    // Should display the message toolbar
    await messageContent.hover({ position: { x: 5, y: 5 } });
    await messageContent.locator('.jp-chat-toolbar jp-button').last().click();

    await expect(messageContent).not.toBeVisible();
    expect(
      await message.locator('.jp-chat-message-header').textContent()
    ).toContain('(message deleted)');
  });
});

test.describe('#ychat', () => {
  const chatContent = {
    messages: [],
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

  test('should add an id to the chat metadata', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    await chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox')
      .waitFor();
    const hasId = async () => {
      const model = await readFileContent(page, FILENAME);
      const content = JSON.parse(model.content) as ReadonlyJSONObject;
      return (
        content.metadata !== undefined &&
        (content.metadata as ReadonlyJSONObject).id !== undefined
      );
    };
    await page.waitForCondition(hasId);
  });
});

test.describe('#outofband', () => {
  const msg = {
    type: 'msg',
    id: UUID.uuid4(),
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341,
    raw_time: false
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

  test('should update message from file', async ({ page }) => {
    const updatedContent = 'Content updated';
    const chatPanel = await openChat(page, FILENAME);
    const messageContent = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();
    const newMsg = { ...msg, body: updatedContent };
    const newContent = {
      messages: [newMsg],
      users: {}
    };
    newContent.users[USERNAME] = USER.identity;

    await page.filebrowser.contents.uploadContent(
      JSON.stringify(newContent),
      'text',
      FILENAME
    );

    await expect(messageContent).toHaveText(updatedContent);
  });

  test('should add a message from file', async ({ page }) => {
    const newMsgContent = 'New message';
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator(
      '.jp-chat-messages-container .jp-chat-message'
    );
    const newMsg = {
      type: 'msg',
      id: UUID.uuid4(),
      sender: USERNAME,
      body: newMsgContent,
      time: msg.time + 5,
      raw_time: false
    };
    const newContent = {
      messages: [msg, newMsg],
      users: {}
    };
    newContent.users[USERNAME] = USER.identity;

    await page.filebrowser.contents.uploadContent(
      JSON.stringify(newContent),
      'text',
      FILENAME
    );

    await expect(messages).toHaveCount(2);
    await expect(
      messages.last().locator('.jp-chat-rendermime-markdown')
    ).toHaveText(newMsgContent);
  });

  test('should delete a message from file', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messageContent = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();
    const newContent = {
      messages: [],
      users: {}
    };
    newContent.users[USERNAME] = USER.identity;

    await page.filebrowser.contents.uploadContent(
      JSON.stringify(newContent),
      'text',
      FILENAME
    );

    await expect(messageContent).not.toBeAttached();
  });
});

test.describe('#sidepanel', () => {
  test.describe('#initialization', () => {
    test('should contain the chat panel icon', async ({ page }) => {
      const chatIcon = page.getByTitle('Jupyter Chat');
      expect(chatIcon).toHaveCount(1);
      expect(await chatIcon.screenshot()).toMatchSnapshot('chat_icon.png');
    });

    test('chat panel should contain a toolbar', async ({ page }) => {
      const panel = await openSidePanel(page);
      const toolbar = panel.locator('.jp-SidePanel-toolbar');
      await expect(toolbar).toHaveCount(1);

      const items = toolbar.locator('.jp-Toolbar-item');
      await expect(items).toHaveCount(2);
      await expect(items.first()).toHaveClass(/.jp-collab-chat-add/);
      await expect(items.last()).toHaveClass(/.jp-collab-chat-open/);
    });

    test('chat panel should not contain a chat at init', async ({ page }) => {
      const panel = await openSidePanel(page);
      const content = panel.locator('.jp-SidePanel-content');
      await expect(content).toBeEmpty();
    });
  });

  test.describe('#creation', () => {
    const name = FILENAME.replace('.chat', '');
    let panel: Locator;
    let dialog: Locator;

    test.beforeEach(async ({ page }) => {
      panel = await openSidePanel(page);
      const addButton = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-add'
      );
      await addButton.click();

      dialog = page.locator('.jp-Dialog');
      await dialog.waitFor();
    });

    test.afterEach(async ({ page }) => {
      for (let filename of ['untitled.chat', FILENAME]) {
        if (await page.filebrowser.contents.fileExists(filename)) {
          await page.filebrowser.contents.deleteFile(filename);
        }
      }
    });

    test('should create a chat', async ({ page }) => {
      await dialog.locator('input[type="text"]').pressSequentially(name);
      await dialog.getByRole('button').getByText('Ok').click();
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(FILENAME)
      );

      const chatTitle = panel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(name);
    });

    test('should create an untitled file if no name is provided', async ({
      page
    }) => {
      await dialog.getByRole('button').getByText('Ok').click();
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists('untitled.chat')
      );

      const chatTitle = panel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText('untitled');
    });

    test('should not create a chat if dialog is cancelled', async () => {
      await dialog.getByRole('button').getByText('Cancel').click();

      const content = panel.locator('.jp-SidePanel-content');
      await expect(content).toBeEmpty();
    });
  });

  test.describe('#openingClosing', () => {
    const name = FILENAME.replace('.chat', '');
    let panel: Locator;
    let select: Locator;

    test.beforeEach(async ({ page }) => {
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
    });

    test.afterEach(async ({ page }) => {
      await page.filebrowser.contents.deleteFile(FILENAME);
    });

    test('should list existing chat', async ({ page }) => {
      // reload to update the chat list
      // FIX: add listener on file creation
      await page.reload();
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-open select'
      );

      await expect(select.locator('option')).toHaveCount(2);
      await expect(select.locator('option').last()).toHaveText(name);
    });

    test('should open an existing chat and close it', async ({ page }) => {
      // reload to update the chat list
      // FIX: add listener on file creation
      await page.reload();
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-open select'
      );

      await select.selectOption(name);

      const chatTitle = panel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(name);

      await chatTitle.getByTitle('Close the chat').click();
      await expect(chatTitle).toHaveCount(0);
    });
  });

  test.describe('#movingChat', () => {
    test.use({ mockSettings: { ...galata.DEFAULT_SETTINGS } });

    test.beforeEach(async ({ page }) => {
      // Create a chat file
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
    });

    test.afterEach(async ({ page }) => {
      if (await page.filebrowser.contents.fileExists(FILENAME)) {
        await page.filebrowser.contents.deleteFile(FILENAME);
      }
    });

    test('main widget toolbar should have a button', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Move the chat to the side panel');
      expect(button).toBeVisible();
      expect(await button.screenshot()).toMatchSnapshot('moveToSide.png');
    });

    test('chat should move to the side panel', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Move the chat to the side panel');
      await button.click();
      await expect(chatPanel).not.toBeAttached();

      const sidePanel = page.locator('.jp-SidePanel.jp-collab-chat-sidepanel');
      await expect(sidePanel).toBeVisible();
      const chatTitle = sidePanel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(FILENAME.split('.')[0]);
    });

    test('side panel should contain a button to move the chat', async ({
      page
    }) => {
      const sidePanel = await openChatToSide(page, FILENAME);
      const chatTitle = sidePanel
        .locator('.jp-SidePanel-content .jp-AccordionPanel-title')
        .first();
      const button = chatTitle.getByTitle('Move the chat to the main area');
      expect(button).toBeVisible();
      expect(await button.screenshot()).toMatchSnapshot('moveToMain.png');
    });

    test('chat should move to the main area', async ({ page }) => {
      const sidePanel = await openChatToSide(page, FILENAME);
      const chatTitle = sidePanel
        .locator('.jp-SidePanel-content .jp-AccordionPanel-title')
        .first();
      const button = chatTitle.getByTitle('Move the chat to the main area');
      await button.click();
      expect(chatTitle).not.toBeAttached();

      await expect(page.activity.getTabLocator(FILENAME)).toBeVisible();
    });
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

  test('messages should be stacked by default', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messagesContainer = chatPanel.locator('.jp-chat-messages-container');
    const messages = messagesContainer.locator('.jp-chat-message');
    await expect(messages).toHaveCount(2);

    // Hide the time to avoid time zone diff
    await messages
      .locator('.jp-chat-message-time')
      .evaluateAll(elements =>
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
