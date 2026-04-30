/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { openChat, openChatToSide, openSettings } from './test-utils';

const FILENAME = 'my-chat.chat';

const fillModal = async (
  page: IJupyterLabPageFixture,
  text = '',
  button: 'Ok' | 'Cancel' = 'Ok'
): Promise<void> => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').pressSequentially(text);
  await dialog.getByRole('button').filter({ hasText: button }).click();
};

test.describe('#commandPalette', () => {
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press('Control+Shift+c');
  });

  test.afterEach(async ({ page, tmpPath }) => {
    for (let filename of [`${tmpPath}/untitled.chat`, FILENAME]) {
      if (await page.filebrowser.contents.fileExists(filename)) {
        await page.filebrowser.contents.deleteFile(filename);
      }
    }
  });

  test('should have 3 commands in palette', async ({ page }) => {
    await expect(
      page.locator('#modal-command-palette li[data-command^="jupyterlab-chat"]')
    ).toHaveCount(3);
  });

  test('should create an untitled chat from command palette', async ({
    page,
    tmpPath
  }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="jupyterlab-chat:createAndOpen"]'
      )
      .click();
    await page.waitForCondition(
      async () =>
        await page.filebrowser.contents.fileExists(`${tmpPath}/untitled.chat`)
    );
    await expect(page.activity.getTabLocator('untitled.chat')).toBeVisible();
  });

  test('should open an existing chat', async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);

    // open it from command palette
    await page
      .locator('#modal-command-palette li[data-command="jupyterlab-chat:open"]')
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

  test('should create a chat from the menu', async ({ page, tmpPath }) => {
    await page.menu.clickMenuItem('File>New>Chat');
    await page.waitForCondition(
      async () =>
        await page.filebrowser.contents.fileExists(`${tmpPath}/untitled.chat`)
    );

    // Delete chat file
    if (
      await page.filebrowser.contents.fileExists(`${tmpPath}/untitled.chat`)
    ) {
      await page.filebrowser.contents.deleteFile(`${tmpPath}/untitled.chat`);
    }
  });
});

test.describe('#launcher', () => {
  test('should have a launcher chat tile in other section', async ({
    page
  }) => {
    const tile = page
      .locator('.jp-LauncherCard[data-category="Other"]')
      .filter({ hasText: 'Chat' });
    await expect(tile).toHaveCount(1);
    expect(await tile.screenshot()).toMatchSnapshot('launcher-tile.png');
  });

  test('should create a chat from the launcher', async ({ page, tmpPath }) => {
    await page.locator('.jp-LauncherCard').getByTitle('Create a chat').click();
    await page.waitForCondition(
      async () =>
        await page.filebrowser.contents.fileExists(`${tmpPath}/untitled.chat`)
    );

    // Delete chat file
    if (
      await page.filebrowser.contents.fileExists(`${tmpPath}/untitled.chat`)
    ) {
      await page.filebrowser.contents.deleteFile(`${tmpPath}/untitled.chat`);
    }
  });
});

test.describe('#focusInput', () => {
  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should focus on the main area chat input', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');

    // hide the chat
    await page.activity.activateTab('Launcher');

    // focus input
    await page.keyboard.press('Control+Shift+1');

    // expect the chat to be visible and the input to be focussed
    await expect(chatPanel).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('should focus on the side panel chat input', async ({ page }) => {
    const chatPanel = await openChatToSide(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');

    // hide the chat
    const chatIcon = page.getByTitle('Jupyter Chat');
    await chatIcon.click();
    await expect(chatPanel).not.toBeVisible();

    // focus input
    await page.keyboard.press('Control+Shift+1');

    // expect the chat to be visible and the input to be focussed
    await expect(chatPanel).toBeVisible();
    await expect(input).toBeFocused();
  });
});

test.describe('#launcher with defaultDirectory', () => {
  const CHAT_DIR = 'launcher_chats';

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.directoryExists(CHAT_DIR)) {
      await page.filebrowser.contents.deleteDirectory(CHAT_DIR);
    }
  });

  // Regression test: the launcher was ignoring the configured defaultDirectory
  // and creating chats in the file browser's current directory instead.
  test('should create a chat in configured default directory', async ({
    page,
    tmpPath
  }) => {
    // Step 1: Configure a custom default directory for chats via settings.
    const settings = await openSettings(page);
    const defaultDirectory = settings.locator(
      'input[label="defaultDirectory"]'
    );
    await defaultDirectory.pressSequentially(CHAT_DIR);
    // Wait for settings to persist (dirty flag appears then clears).
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    // Step 2: Create a chat from the launcher (not the side panel).
    // The file browser is at tmpPath, so without the fix this would
    // create the chat in tmpPath instead of CHAT_DIR.
    await page.activity.activateTab('Launcher');
    await page.locator('.jp-LauncherCard').getByTitle('Create a chat').click();

    // Step 3: Verify the chat was created in the configured directory.
    await page.waitForCondition(
      async () =>
        await page.filebrowser.contents.fileExists(
          `${CHAT_DIR}/untitled.chat`
        )
    );

    // And NOT in the file browser's current directory.
    expect(
      await page.filebrowser.contents.fileExists(`${tmpPath}/untitled.chat`)
    ).toBe(false);
  });
});
