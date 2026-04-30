/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';

import {
  openChat,
  openSettings,
  sendMessage,
  splitMainArea
} from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';

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
    await sendMessage(page, FILENAME, MSG_CONTENT);

    const messages = chatPanel.locator('.jp-chat-messages-container');
    await expect(messages.locator('.jp-chat-message')).toHaveCount(1);
    // It seems that the markdown renderer adds a new line.
    await expect(
      messages.locator('.jp-chat-message .jp-chat-rendered-message')
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
      messages.locator('.jp-chat-message .jp-chat-rendered-message')
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
      messages.locator('.jp-chat-message .jp-chat-rendered-message')
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
      messages.locator('.jp-chat-message .jp-chat-rendered-message')
    ).toHaveText(MSG_CONTENT + '\n');
  });
});

test.describe('#sendWithSelection', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      'jupyterlab-chat-extension:factory': {
        sendWithSelection: true
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should hide send-with-selection button when setting is disabled', async ({
    page
  }) => {
    const settings = await openSettings(page);
    await page.pause();
    const sendWithSelection = settings?.getByRole('checkbox', {
      name: 'sendWithSelection'
    });
    await sendWithSelection?.uncheck();

    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    const chatPanel = await openChat(page, FILENAME);
    const openerButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-include-opener'
    );
    await expect(openerButton).not.toBeAttached();
  });

  test('should update send-with-selection button on existing chat', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);

    const settings = await openSettings(page);
    const sendWithSelection = settings?.getByRole('checkbox', {
      name: 'sendWithSelection'
    });
    await sendWithSelection?.uncheck();

    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    await page.activity.activateTab(FILENAME);
    const openerButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-include-opener'
    );
    await expect(openerButton).not.toBeAttached();
  });

  test('should disable send with selection when there is no notebook', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const openerButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-include-opener'
    );
    const sendWithSelectionItem = page.locator('.jp-chat-send-include');

    await input.pressSequentially(MSG_CONTENT);
    await openerButton.click();
    await expect(sendWithSelectionItem).toBeVisible();
    await expect(sendWithSelectionItem).toBeDisabled();
    await expect(sendWithSelectionItem).toContainText(
      'No selection or active cell'
    );
  });

  test('should send with code cell content', async ({ page }) => {
    const cellContent = 'a = 1\nprint(f"a={a}")';
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const openerButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-include-opener'
    );
    const sendWithSelectionItem = page.locator('.jp-chat-send-include');

    const notebook = await page.notebook.createNew();
    const cell = (await page.notebook.getCellLocator(0))!;
    await cell.getByRole('textbox').pressSequentially(cellContent);

    await splitMainArea(page, notebook!);

    await input.pressSequentially(MSG_CONTENT);
    await openerButton.click();
    await expect(sendWithSelectionItem).toBeVisible();
    await expect(sendWithSelectionItem).toBeEnabled();
    await expect(sendWithSelectionItem).toContainText(
      'Code from 1 active cell'
    );
    await sendWithSelectionItem.click();
    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    const rendered = messages.locator(
      '.jp-chat-message .jp-chat-rendered-message'
    );
    await expect(rendered).toHaveText(`${MSG_CONTENT}\n${cellContent}\n`);
    await expect(rendered.locator('code')).toHaveClass('language-python');
  });

  test('should send with markdown cell content', async ({ page }) => {
    const cellContent = 'markdown content';
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const openerButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-include-opener'
    );
    const sendWithSelectionItem = page.locator('.jp-chat-send-include');

    const notebook = await page.notebook.createNew();
    const cell = (await page.notebook.getCellLocator(0))!;
    await page.notebook.setCellType(0, 'markdown');
    await cell.getByRole('textbox').pressSequentially(cellContent);

    await splitMainArea(page, notebook!);

    await input.pressSequentially(MSG_CONTENT);
    await openerButton.click();
    await expect(sendWithSelectionItem).toBeVisible();
    await expect(sendWithSelectionItem).toBeEnabled();
    await expect(sendWithSelectionItem).toContainText(
      'Code from 1 active cell'
    );
    await sendWithSelectionItem.click();
    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    const rendered = messages.locator(
      '.jp-chat-message .jp-chat-rendered-message'
    );
    await expect(rendered).toHaveText(`${MSG_CONTENT}\n${cellContent}\n`);
    await expect(rendered.locator('code')).toHaveClass('');
  });

  test('should send with text selection', async ({ page }) => {
    const cellContent = 'a = 1\nprint(f"a={a}")';
    const chatPanel = await openChat(page, FILENAME);
    const messages = chatPanel.locator('.jp-chat-messages-container');
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const openerButton = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-send-include-opener'
    );
    const sendWithSelectionItem = page.locator('.jp-chat-send-include');

    const notebook = await page.notebook.createNew();
    await splitMainArea(page, notebook!);

    const cell = (await page.notebook.getCellLocator(0))!;
    await cell.getByRole('textbox').pressSequentially(cellContent);

    await expect(cell.locator('.cm-line')).toHaveCount(2);
    await expect(
      cell.locator('.cm-line').nth(1).locator('.cm-builtin')
    ).toBeAttached();

    const selection = cell
      ?.locator('.cm-line')
      .nth(1)
      .locator('.cm-builtin')
      .first();
    await selection.dblclick({ position: { x: 10, y: 10 } });

    await input.pressSequentially(MSG_CONTENT);
    await openerButton.click();
    await expect(sendWithSelectionItem).toBeVisible();
    await expect(sendWithSelectionItem).toBeEnabled();
    await expect(sendWithSelectionItem).toContainText('1 line(s) selected');
    await sendWithSelectionItem.click();

    await expect(messages!.locator('.jp-chat-message')).toHaveCount(1);

    const rendered = messages.locator(
      '.jp-chat-message .jp-chat-rendered-message'
    );
    await expect(rendered).toHaveText(`${MSG_CONTENT}\nprint\n`);
    await expect(rendered.locator('code')).toHaveClass(/language-[i]?python/);
  });
});
