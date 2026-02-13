/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';

import { openChat, openSettings, sendMessage } from './test-utils';

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
