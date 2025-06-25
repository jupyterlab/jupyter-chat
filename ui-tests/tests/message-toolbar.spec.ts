/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';
import { UUID } from '@lumino/coreutils';

import { openChat, USER } from './test-utils';

const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
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
      .locator('.jp-chat-messages-container .jp-chat-rendered-markdown')
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
    const messageContent = message.locator('.jp-chat-rendered-markdown');

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
    const messageContent = message.locator('.jp-chat-rendered-markdown');

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

  test('should not render deleted message', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messagesContainer = chatPanel.locator('.jp-chat-messages-container');

    const messageCountBefore = await messagesContainer
      .locator('.jp-chat-message')
      .count();
    expect(messageCountBefore).toBe(1);

    const message = messagesContainer.locator('.jp-chat-message').first();
    const messageContent = message.locator('.jp-chat-rendered-markdown');

    // Should display the message toolbar
    await messageContent.hover({ position: { x: 5, y: 5 } });
    await messageContent.locator('.jp-chat-toolbar jp-button').last().click();

    await expect(message).not.toBeVisible();

    const messageCountAfter = await messagesContainer
      .locator('.jp-chat-message')
      .count();
    expect(messageCountAfter).toBe(0);
  });
});
