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

import {
  openChat,
  openChatToSide,
  openSettings,
  sendMessage,
  USER
} from './test-utils';

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
        '.jp-PluginList-entry[data-id="jupyterlab-collaborative-chat-extension:factory"]'
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

  test.afterEach(async () => {
    await guestPage.close();
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
});
