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

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = UUID.uuid4();
const USER: User.IUser = {
  identity: {
    username: USERNAME,
    name: 'jovyan',
    display_name: 'jovyan',
    initials: 'JP',
    color: 'var(--jp-collaborator-color1)'
  },
  permissions: {}
};

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

const openPanel = async (page: IJupyterLabPageFixture): Promise<Locator> => {
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
      .getByRole('textbox');
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
      .getByRole('textbox');
    await input.pressSequentially(MSG_CONTENT);
    await input.press('Enter');

    const messages = chatPanel.locator('.jp-chat-messages-container');
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    // It seems that the markdown renderer adds a new line.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendermime-markdown')
    ).toHaveText(MSG_CONTENT + '\n');
  });
});

test.describe('#raw_time', () => {
  const msgID_raw = UUID.uuid4();
  const msg_raw_time: IChatMessage = {
    type: 'msg',
    id: msgID_raw,
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341,
    raw_time: true
  };
  const msgID_verif = UUID.uuid4();
  const msg_verif: IChatMessage = {
    type: 'msg',
    id: msgID_verif,
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341,
    raw_time: false
  };
  const chatContent = {
    messages: {},
    users: {}
  };
  chatContent.users[USERNAME] = USER.identity;
  chatContent.messages[msgID_raw] = msg_raw_time;
  chatContent.messages[msgID_verif] = msg_verif;

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
  const additionnalContent = ' Messages can be edited';

  const msgID = UUID.uuid4();
  const msg: IChatMessage = {
    type: 'msg',
    id: msgID,
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341
  };
  const chatContent = {
    messages: {},
    users: {}
  };
  chatContent.users[USERNAME] = USER.identity;
  chatContent.messages[msgID] = msg;

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
      .getByRole('textbox');

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

test.describe('#outofband', () => {
  const msgID = UUID.uuid4();
  const msg: IChatMessage = {
    type: 'msg',
    id: msgID,
    sender: USERNAME,
    body: MSG_CONTENT,
    time: 1714116341
  };
  const chatContent = {
    messages: {},
    users: {}
  };
  chatContent.users[USERNAME] = USER.identity;
  chatContent.messages[msgID] = msg;

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
      messages: {},
      users: {}
    };
    newContent.users[USERNAME] = USER.identity;
    newContent.messages[msgID] = newMsg;

    await page.filebrowser.contents.uploadContent(
      JSON.stringify(newContent),
      'text',
      FILENAME
    );

    await expect(messageContent).toHaveText(updatedContent);
  });

  test('should add a message from file', async ({ page }) => {
    const newMsgContent = 'New message';
    const newMsgID = UUID.uuid4();
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator(
      '.jp-chat-messages-container .jp-chat-message'
    );
    const newMsg: IChatMessage = {
      type: 'msg',
      id: newMsgID,
      sender: USERNAME,
      body: newMsgContent,
      time: msg.time + 5
    };
    const newContent = {
      messages: {},
      users: {}
    };
    newContent.users[USERNAME] = USER.identity;
    newContent.messages[msgID] = msg;
    newContent.messages[newMsgID] = newMsg;

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
      messages: {},
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
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('textbox');
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
      .getByRole('textbox');
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

test.describe('#chatPanel', () => {
  test.describe('#initiailization', () => {
    test('should contain the chat panel icon', async ({ page }) => {
      const chatIcon = page.getByTitle('Jupyter Chat');
      expect(chatIcon).toHaveCount(1);
      expect(await chatIcon.screenshot()).toMatchSnapshot('chat_icon.png');
    });

    test('chat panel should contain a toolbar', async ({ page }) => {
      const panel = await openPanel(page);
      const toolbar = panel.locator('.jp-SidePanel-toolbar');
      await expect(toolbar).toHaveCount(1);

      const items = toolbar.locator('.jp-Toolbar-item');
      await expect(items).toHaveCount(2);
      await expect(items.first()).toHaveClass(/.jp-collab-chat-add/);
      await expect(items.last()).toHaveClass(/.jp-collab-chat-open/);
    });

    test('chat panel should not contain a chat at init', async ({ page }) => {
      const panel = await openPanel(page);
      const content = panel.locator('.jp-SidePanel-content');
      await expect(content).toBeEmpty();
    });
  });

  test.describe('#chatCreation', () => {
    const name = 'my-chat';
    let panel: Locator;
    let dialog: Locator;

    test.beforeEach(async ({ page }) => {
      panel = await openPanel(page);
      const addButton = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-add'
      );
      await addButton.click();

      dialog = page.locator('.jp-Dialog');
      await dialog.waitFor();
    });

    test.afterEach(async ({ page }) => {
      for (let filename of ['untitled.chat', `${name}.chat`]) {
        if (await page.filebrowser.contents.fileExists(filename)) {
          await page.filebrowser.contents.deleteFile(filename);
        }
      }
    });

    test('should create a chat', async ({ page }) => {
      await dialog.locator('input[type="text"]').pressSequentially(name);
      await dialog.getByRole('button').getByText('Ok').click();
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(`${name}.chat`)
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

    test('should not create a chat if dialog is cancelled', async ({
      page
    }) => {
      await dialog.getByRole('button').getByText('Cancel').click();

      const content = panel.locator('.jp-SidePanel-content');
      await expect(content).toBeEmpty();
    });
  });

  test.describe('#openingClosing', () => {
    const name = 'my-chat';
    let panel: Locator;
    let select: Locator;

    test.beforeEach(async ({ page }) => {
      await page.filebrowser.contents.uploadContent(
        '{}',
        'text',
        `${name}.chat`
      );
    });

    test.afterEach(async ({ page }) => {
      await page.filebrowser.contents.deleteFile(`${name}.chat`);
    });

    test('should list existing chat', async ({ page }) => {
      // reload to update the chat list
      // FIX: add listener on file creation
      await page.reload();
      panel = await openPanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-open select'
      );

      for (let i = 0; i < (await select.locator('option').count()); i++) {
        console.log(await select.locator('option').nth(i).textContent());
      }
      await expect(select.locator('option')).toHaveCount(2);
      await expect(select.locator('option').last()).toHaveText(name);
    });

    test('should open an existing chat and close it', async ({ page }) => {
      // reload to update the chat list
      // FIX: add listener on file creation
      await page.reload();
      panel = await openPanel(page);
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

      await chatTitle.getByRole('button').click();
      await expect(chatTitle).toHaveCount(0);
    });
  });
});
