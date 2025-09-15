/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { openChat, openChatToSide } from './test-utils';

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

  test('should have 3 commands in palette', async ({ page }) => {
    await expect(
      page.locator('#modal-command-palette li[data-command^="jupyterlab-chat"]')
    ).toHaveCount(3);
  });

  test('should create a chat with name from command palette', async ({
    page,
    tmpPath
  }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="jupyterlab-chat:create"]'
      )
      .click();
    await fillModal(page, name);
    await page.waitForCondition(
      async () =>
        await page.filebrowser.contents.fileExists(`${tmpPath}/${FILENAME}`)
    );
    await expect(page.activity.getTabLocator(FILENAME)).toBeVisible();
  });

  test('should create an untitled chat from command palette', async ({
    page
  }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="jupyterlab-chat:create"]'
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
        '#modal-command-palette li[data-command="jupyterlab-chat:create"]'
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

  test('should open modal create from the menu', async ({ page }) => {
    await page.menu.clickMenuItem('File>New>Chat');
    await expect(page.locator('dialog .jp-Dialog-header')).toHaveText(
      'Create a new chat'
    );
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

  test('should open modal create from the launcher', async ({ page }) => {
    await page.locator('.jp-LauncherCard').getByTitle('Create a chat').click();
    await expect(page.locator('dialog .jp-Dialog-header')).toHaveText(
      'Create a new chat'
    );
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
