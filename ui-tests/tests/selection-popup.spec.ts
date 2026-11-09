/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';

import { openChat, splitMainArea } from './test-utils';

const FILENAME = 'selection-popup.chat';

test.use({
  mockSettings: {
    ...galata.DEFAULT_SETTINGS,
    'jupyterlab-chat-extension:factory': {
      showSelectionActions: true
    }
  }
});

test.describe('#selectionPopup', () => {
  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should add the selection to the chat and send it', async ({
    page,
    tmpPath
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const notebook = (await page.notebook.createNew())!;
    await splitMainArea(page, notebook);
    const cell = (await page.notebook.getCellLocator(0))!;
    await cell.getByRole('textbox').pressSequentially('a = 1\nprint(f"a={a}")');
    // Wait for CodeMirror to highlight the second line.
    const print = cell.locator('.cm-line').nth(1).locator('.cm-builtin');
    await expect(print).toBeAttached();

    const popup = page.locator('.jp-chat-selection-popup');
    const input = chatPanel.locator('.jp-chat-input-container');
    const chip = input.locator('.jp-chat-pending-snippet');
    const sendButton = input.locator('.jp-chat-send-button');
    const messages = chatPanel.locator('.jp-chat-messages-container');

    await expect(sendButton).toBeDisabled();
    await print.first().dblclick({ position: { x: 10, y: 10 } });
    await expect(popup).toBeVisible();

    await popup.locator('.jp-chat-selection-popup-action').click();
    await expect(popup).toBeHidden();
    await expect(chip).toHaveText(
      new RegExp(`^${notebook.replace('.', '\\.')} · cell \\w{8} · lines 2-2$`)
    );
    await expect(sendButton).toBeEnabled();

    await sendButton.click();
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    await expect(chip).toHaveCount(0);

    const rendered = messages.locator(
      '.jp-chat-message .jp-chat-rendered-message'
    );
    // The header holds the path of the notebook, the chip its name only.
    await expect(rendered).toContainText(`From ${tmpPath}/${notebook}`);
    await expect(rendered).toContainText('lines 2-2:');
    await expect(rendered.locator('pre code')).toHaveText('print\n');

    // The palette command stages another selection too, and hides the popup.
    await cell.locator('.cm-line').first().click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await expect(popup).toBeVisible();
    await page.evaluate(() =>
      window.jupyterapp.commands.execute('jupyterlab-chat:addToChat')
    );
    await expect(chip).toHaveCount(1);
    await expect(popup).toBeHidden();
  });
});

test.describe('#selectionPopupWithoutChat', () => {
  // The new chat is created in `defaultDirectory`. Its own directory keeps it
  // away from the chats the other test files create in the shared root
  // directory, see https://github.com/jupyterlab/jupyter-chat/issues/471.
  const CHAT_DIR = 'selection-popup-chats';

  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      'jupyterlab-chat-extension:factory': {
        showSelectionActions: true,
        defaultDirectory: CHAT_DIR
      }
    }
  });

  // The extension creates the directory itself when it loads the setting.
  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.directoryExists(CHAT_DIR)) {
      await page.filebrowser.contents.deleteDirectory(CHAT_DIR);
    }
  });

  test('should open a chat in the side panel when none is open', async ({
    page
  }) => {
    const notebook = (await page.notebook.createNew())!;
    const cell = (await page.notebook.getCellLocator(0))!;
    await cell.getByRole('textbox').pressSequentially('a = 1\nprint(f"a={a}")');
    const print = cell.locator('.cm-line').nth(1).locator('.cm-builtin');
    await expect(print).toBeAttached();

    const popup = page.locator('.jp-chat-selection-popup');
    await print.first().dblclick({ position: { x: 10, y: 10 } });
    await expect(popup).toBeVisible();
    await popup.locator('.jp-chat-selection-popup-action').click();

    // A new chat is created in the default directory and opened in the side
    // panel, with the selection staged.
    await page.waitForCondition(
      async () =>
        await page.filebrowser.contents.fileExists(`${CHAT_DIR}/untitled.chat`)
    );
    const sidePanel = page.locator('.jp-chat-sidepanel');
    await expect(sidePanel).toBeVisible();
    await expect(sidePanel.locator('.jp-chat-pending-snippet')).toHaveText(
      new RegExp(`^${notebook.replace('.', '\\.')} · cell \\w{8} · lines 2-2$`)
    );
  });
});
