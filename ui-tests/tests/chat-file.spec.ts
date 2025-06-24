/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  expect,
  galata,
  IJupyterLabPageFixture,
  test
} from '@jupyterlab/galata';
import { Contents } from '@jupyterlab/services';
import { ReadonlyJSONObject, UUID } from '@lumino/coreutils';

import { createChat, openChat, openSettings, USER } from './test-utils';
import { PathExt } from '@jupyterlab/coreutils';

const CHAT_NAME = 'my-chat';
const FILENAME = 'my-chat.chat';
const MSG_CONTENT = 'Hello World!';
const USERNAME = USER.identity.username;

test.use({
  mockUser: USER,
  mockSettings: { ...galata.DEFAULT_SETTINGS }
});

const readFileContent = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<Contents.IModel> => {
  return await page.evaluate(async filepath => {
    return await window.jupyterapp.serviceManager.contents.get(filepath);
  }, filename);
};

test.describe('#chatCreation', () => {
  const CHAT_DIR = 'chats';

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteDirectory(FILENAME);
    }

    if (await page.filebrowser.contents.directoryExists(CHAT_DIR)) {
      await page.filebrowser.contents.deleteDirectory(CHAT_DIR);
    }
  });

  test('should create a file in root directory', async ({ page }) => {
    await createChat(page, CHAT_NAME, true);
    expect(await page.filebrowser.contents.fileExists(FILENAME)).toBeTruthy();
  });

  test('should create a default directory and remove it as empty', async ({
    page
  }) => {
    const settings = await openSettings(page);
    const defaultDirectory = settings.locator(
      'input[label="defaultDirectory"]'
    );
    await defaultDirectory.pressSequentially(CHAT_DIR);

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    expect(
      await page.filebrowser.contents.directoryExists(CHAT_DIR)
    ).toBeTruthy();

    // Clearing the default directory settings should remove former empty default directory.
    await defaultDirectory.clear();

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    expect(
      await page.filebrowser.contents.directoryExists(CHAT_DIR)
    ).toBeFalsy();
  });

  test('should create a chat in default directory and keep not empty directory', async ({
    page
  }) => {
    const settings = await openSettings(page);
    const defaultDirectory = settings.locator(
      'input[label="defaultDirectory"]'
    );
    await defaultDirectory.pressSequentially(CHAT_DIR);

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    await createChat(page, CHAT_NAME, true);
    expect(
      await page.filebrowser.contents.fileExists(
        PathExt.join(CHAT_DIR, FILENAME)
      )
    ).toBeTruthy();

    // Reactivate settings panel
    await openSettings(page);

    // Clearing the default directory settings should not remove not empty default directory.
    await defaultDirectory.clear();

    // wait for the settings to be saved
    await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );
    await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
      'class',
      /jp-mod-dirty/
    );

    expect(
      await page.filebrowser.contents.directoryExists(CHAT_DIR)
    ).toBeTruthy();
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
      .locator('.jp-chat-messages-container .jp-chat-rendered-markdown')
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
      messages.last().locator('.jp-chat-rendered-markdown')
    ).toHaveText(newMsgContent);
  });

  test('should delete a message from file', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const messageContent = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-rendered-markdown')
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
