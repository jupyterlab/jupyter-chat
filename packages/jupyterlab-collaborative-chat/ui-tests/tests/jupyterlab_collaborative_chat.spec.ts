/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatMessage } from '@jupyter/chat';
import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test
} from '@jupyterlab/galata';
import { User } from '@jupyterlab/services';
import { UUID } from '@lumino/coreutils';
import { Locator } from '@playwright/test';

const fillModal = async (
  page: IJupyterLabPageFixture,
  text = '',
  button: 'Ok' | 'Cancel' = 'Ok'
) => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').pressSequentially(text);
  await dialog.getByRole('button').filter({ hasText: button }).click();
};

const openChat = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<Locator> => {
  await page.evaluate(async filepath => {
    await window.jupyterapp.commands.execute('collaborative-chat:open', {
      filepath
    });
  }, filename);
  await page.waitForCondition(
    async () => await page.activity.isTabActive(filename)
  );
  return (await page.activity.getPanelLocator(filename)) as Locator;
};

const openSettings = async (
  page: IJupyterLabPageFixture,
  globalSettings?: boolean
): Promise<Locator> => {
  const args = globalSettings ? {} : { query: 'Chat' };
  await page.evaluate(async args => {
    await window.jupyterapp.commands.execute('settingeditor:open', args);
  }, args);
  await page.activity.activateTab('Settings');
  return (await page.activity.getPanelLocator('Settings')) as Locator;
};

test.describe('#commandPalette', () => {
  const name = 'my-chat';

  test.beforeEach(async ({ page }) => {
    await page.keyboard.press('Control+Shift+c');
  });

  test.afterEach(async ({ page }) => {
    for (let filename of ['untitled.chat', `${name}.chat`]) {
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
      async () => await page.filebrowser.contents.fileExists(`${name}.chat`)
    );
    await expect(page.activity.getTabLocator(`${name}.chat`)).toBeVisible();
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
    await page.filebrowser.contents.uploadContent('{}', 'text', `${name}.chat`);

    // open it from command palette
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:open"]'
      )
      .click();
    await fillModal(page, `${name}.chat`);
    await expect(page.activity.getTabLocator(`${name}.chat`)).toBeVisible();
  });
});

test.describe('#menuNew', () => {
  test('should have an entry in main menu -> new', async ({ page }) => {
    const menu = await page.menu.open('File>New');
    expect(await menu?.screenshot()).toMatchSnapshot('menu-new.png');
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
    const tile = page
      .locator('.jp-LauncherCard[data-category="Chat"]')
      .getByTitle('Create a chat');
    expect(await tile.screenshot()).toMatchSnapshot('launcher-tile.png');
  });

  test('should open modal create from the launcher', async ({ page }) => {
    await page.locator('.jp-LauncherCard').getByTitle('Create a chat').click();
    await expect(page.locator('dialog .jp-Dialog-header')).toHaveText(
      'Create a new chat'
    );
  });
});

test.describe('#messages', () => {
  const filename = 'my-chat.chat';
  const msg = 'Hello world!';

  test.use({ mockSettings: { ...galata.DEFAULT_SETTINGS } });

  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', filename);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(filename)) {
      await page.filebrowser.contents.deleteFile(filename);
    }
  });

  test('should send a message using button', async ({ page }) => {
    const chatPanel = await openChat(page, filename);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('textbox');
    const sendButton = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('button');
    await input.pressSequentially(msg);
    await sendButton.click();

    const messages = chatPanel.locator('.jp-chat-messages-container');
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    // It seems that the markdown renderer adds a new line.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(msg + '\n');
  });

  test('should send a message using keyboard', async ({ page }) => {
    const chatPanel = await openChat(page, filename);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('textbox');
    await input.pressSequentially(msg);
    await input.press('Enter');

    const messages = chatPanel.locator('.jp-chat-messages-container');
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    // It seems that the markdown renderer adds a new line.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(msg + '\n');
  });
});

test.describe('#raw_time', () => {
  const filename = 'my-chat.chat';
  const originalContent = 'Hello World!';
  const username = UUID.uuid4();
  const user: User.IUser = {
    identity: {
      username: username,
      name: 'jovyan',
      display_name: 'jovyan',
      initials: 'JP',
      color: 'var(--jp-collaborator-color1)'
    },
    permissions: {}
  };
  const msgID_raw = UUID.uuid4();
  const msg_raw_time: IChatMessage = {
    type: 'msg',
    id: msgID_raw,
    sender: username,
    body: originalContent,
    time: 1714116341,
    raw_time: true
  };
  const msgID_verif = UUID.uuid4();
  const msg_verif: IChatMessage = {
    type: 'msg',
    id: msgID_verif,
    sender: username,
    body: originalContent,
    time: 1714116341,
    raw_time: false
  };
  const chatContent = {
    messages: {},
    users: {}
  };
  chatContent.users[username] = user.identity;
  chatContent.messages[msgID_raw] = msg_raw_time;
  chatContent.messages[msgID_verif] = msg_verif;

  test.use({
    mockUser: user
  });

  test.beforeEach(async ({ page }) => {
    // Create a chat file with content
    await page.filebrowser.contents.uploadContent(
      JSON.stringify(chatContent),
      'text',
      filename
    );
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(filename)) {
      await page.filebrowser.contents.deleteFile(filename);
    }
  });

  test('message timestamp should be raw according to file content', async ({
    page
  }) => {
    const chatPanel = await openChat(page, filename);
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
    const chatPanel = await openChat(page, filename);
    const messages = chatPanel.locator(
      '.jp-chat-messages-container .jp-chat-message'
    );

    // Send a new message
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('textbox');
    const sendButton = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('button');
    await input.pressSequentially('New message');
    await sendButton.click();

    expect(messages).toHaveCount(3);
    await expect(
      messages.locator('.jp-chat-message-time').last()
    ).toHaveAttribute('title', '');
  });
});

test.describe('#messageToolbar', () => {
  const filename = 'my-chat.chat';
  const originalContent = 'Hello World!';
  const additionnalContent = ' Messages can be edited';
  const username = UUID.uuid4();
  const user: User.IUser = {
    identity: {
      username: username,
      name: 'jovyan',
      display_name: 'jovyan',
      initials: 'JP',
      color: 'var(--jp-collaborator-color1)'
    },
    permissions: {}
  };

  const msgID = UUID.uuid4();
  const msg: IChatMessage = {
    type: 'msg',
    id: msgID,
    sender: username,
    body: originalContent,
    time: 1714116341
  };
  const chatContent = {
    messages: {},
    users: {}
  };
  chatContent.users[username] = user.identity;
  chatContent.messages[msgID] = msg;

  test.use({
    mockUser: user
  });

  test.beforeEach(async ({ page }) => {
    // Create a chat file with content
    await page.filebrowser.contents.uploadContent(
      JSON.stringify(chatContent),
      'text',
      filename
    );
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(filename)) {
      await page.filebrowser.contents.deleteFile(filename);
    }
  });

  test('message should have a toolbar', async ({ page }) => {
    const chatPanel = await openChat(page, filename);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();

    await expect(message.locator('.jp-chat-toolbar')).not.toBeVisible();

    //Should display the message toolbar
    await message.hover({ position: { x: 5, y: 5 } });
    await expect(message.locator('.jp-chat-toolbar')).toBeVisible();
  });

  test('should update the message', async ({ page }) => {
    const chatPanel = await openChat(page, filename);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();

    // Should display the message toolbar
    await message.hover({ position: { x: 5, y: 5 } });
    await message.locator('.jp-chat-toolbar jp-button').first().click();

    await expect(message).not.toBeVisible();

    const editInput = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-input-container')
      .getByRole('textbox');

    await expect(editInput).toBeVisible();
    await editInput.focus();
    await editInput.press('End');
    await editInput.pressSequentially(additionnalContent);
    await editInput.press('Enter');

    // It seems that the markdown renderer adds a new line.
    await expect(message).toHaveText(
      originalContent + additionnalContent + '\n'
    );
  });

  test('should cancel message edition', async ({ page }) => {
    const chatPanel = await openChat(page, filename);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();

    // Should display the message toolbar
    await message.hover({ position: { x: 5, y: 5 } });
    await message.locator('.jp-chat-toolbar jp-button').first().click();

    await expect(message).not.toBeVisible();

    const editInput = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-input-container')
      .getByRole('textbox');

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
    await expect(message).toHaveText(originalContent + '\n');
  });

  test('should delete the message', async ({ page }) => {
    const chatPanel = await openChat(page, filename);
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendermime-markdown')
      .first();

    // Should display the message toolbar
    await message.hover({ position: { x: 5, y: 5 } });
    await message.locator('.jp-chat-toolbar jp-button').last().click();

    await expect(message).not.toBeVisible();
  });
});

test.describe('#settings', () => {
  const filename = 'my-chat.chat';
  const msg = 'Hello world!';

  test.use({ mockSettings: { ...galata.DEFAULT_SETTINGS } });

  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', filename);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(filename)) {
      await page.filebrowser.contents.deleteFile(filename);
    }
  });

  test('should have chat settings', async ({ page }) => {
    const settings = await openSettings(page, true);
    await expect(
      settings.locator(
        '.jp-PluginList-entry[data-id="jupyterlab-collaborative-chat:factories"]'
      )
    ).toBeVisible();
  });

  test('should have default settings values', async ({ page }) => {
    const settings = await openSettings(page);
    const sendWithShiftEnter = settings?.getByRole('checkbox', {
      name: 'sendWithShiftEnter'
    });
    expect(sendWithShiftEnter!).not.toBeChecked();
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
    const chatPanel = await openChat(page, filename);
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('textbox');
    await input!.pressSequentially(msg);
    await input!.press('Enter');

    await expect(messages!.locator('.jp-chat-message')).toHaveCount(0);

    // Should not send message with Shift+Enter
    await input!.press('Shift+Enter');
    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    // It seems that the markdown renderer adds a new line, but the '\n' inserter when
    // pressing Enter above is trimmed.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(msg + '\n');
  });

  test('should update settings value sendWithShiftEnter on existing chat', async ({
    page
  }) => {
    const chatPanel = await openChat(page, filename);

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
    await page.activity.activateTab(filename);

    // Should not send message with Enter
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('textbox');
    await input!.pressSequentially(msg);
    await input!.press('Enter');

    await expect(messages!.locator('.jp-chat-message')).toHaveCount(0);

    // Should not send message with Shift+Enter
    await input!.press('Shift+Enter');
    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    // It seems that the markdown renderer adds a new line, but the '\n' inserted when
    // pressing Enter above is trimmed.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(msg + '\n');
  });
});
