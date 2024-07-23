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

import { openChat, sendMessage, USER } from './test-utils';

test.use({
  mockUser: USER,
  mockSettings: {
    ...galata.DEFAULT_SETTINGS,
    'jupyterlab-collaborative-chat:factory': {
      sendWithShiftEnter: true
    }
  }
});

const FILENAME = 'my-chat.chat';
const CONTENT = 'print("This is a code cell")';
const MESSAGE = `\`\`\`\n${CONTENT}\n\`\`\``;

async function splitMainArea(page: IJupyterLabPageFixture, name: string) {
  // Emulate drag and drop
  const viewerHandle = page.activity.getTabLocator(name);
  const viewerBBox = await viewerHandle.boundingBox();

  await page.mouse.move(
    viewerBBox!.x + 0.5 * viewerBBox!.width,
    viewerBBox!.y + 0.5 * viewerBBox!.height
  );
  await page.mouse.down();
  await page.mouse.move(viewerBBox!.x + 0.5 * viewerBBox!.width, 600);
  await page.mouse.up();
}

test.describe('#codeToolbar', () => {
  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('should have a code toolbar', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbar = message.locator('.jp-chat-code-toolbar');
    const toolbarItems = message.locator('.jp-chat-code-toolbar-item');

    await sendMessage(page, FILENAME, MESSAGE);
    await expect(message).toBeAttached();
    await expect(toolbar).toBeAttached();
    await expect(toolbarItems).toHaveCount(4);
  });

  test('should not have a code toolbar', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbar = message.locator('.jp-chat-code-toolbar');

    await sendMessage(page, FILENAME, 'Simple message');
    await expect(message).toBeAttached();
    await expect(toolbar).not.toBeAttached();
  });

  test('buttons should be disabled without notebook', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    await sendMessage(page, FILENAME, MESSAGE);
    await expect(toolbarButtons).toHaveCount(4);
    for (let i = 0; i < 3; i++) {
      await expect(toolbarButtons.nth(i)).toBeDisabled();
    }
    await expect(toolbarButtons.nth(3)).toBeEnabled();
  });

  test('buttons should be disabled with a non visible notebook', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);
    for (let i = 0; i < 3; i++) {
      await expect(toolbarButtons.nth(i)).toBeDisabled();
    }
  });

  test('buttons should be enabled with a visible notebook', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    const notebook = await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);
    await splitMainArea(page, notebook!);
    for (let i = 0; i < 3; i++) {
      await expect(toolbarButtons.nth(i)).toBeEnabled();
    }
  });

  test('insert code above', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    const notebook = await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);
    await splitMainArea(page, notebook!);
    // activate the first cell.
    await page.notebook.selectCells(0);

    await toolbarButtons.first().click();

    await page.activity.activateTab(notebook!);
    await page.waitForCondition(
      async () => (await page.notebook.getCellCount()) === 2
    );
    expect(await page.notebook.getCellTextInput(0)).toBe(`${CONTENT}\n`);
  });

  test('insert code below', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    const notebook = await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);
    await splitMainArea(page, notebook!);

    // activate the first cell.
    await page.notebook.selectCells(0);

    await toolbarButtons.nth(1).click();

    await page.activity.activateTab(notebook!);
    await page.waitForCondition(
      async () => (await page.notebook.getCellCount()) === 2
    );
    expect(await page.notebook.getCellTextInput(1)).toBe(`${CONTENT}\n`);
  });

  test('replace active cell', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    const notebook = await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);
    await splitMainArea(page, notebook!);

    // write content in the first cell.
    const cell = await page.notebook.getCellLocator(0);
    await cell?.getByRole('textbox').pressSequentially('initial content');
    await toolbarButtons.nth(2).click();

    await page.activity.activateTab(notebook!);
    await page.waitForCondition(
      async () =>
        (await page.notebook.getCellTextInput(0)) !== 'initial content'
    );
    expect(await page.notebook.getCellTextInput(0)).toBe(`${CONTENT}\n`);
  });

  test('should copy code content', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item button');

    const notebook = await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);

    // Copy the message code content to clipboard.
    await toolbarButtons.last().click();

    await page.activity.activateTab(notebook!);
    const cell = await page.notebook.getCellLocator(0);
    await cell?.getByRole('textbox').press('Control+V');
    await page.waitForCondition(
      async () => (await page.notebook.getCellTextInput(0)) !== ''
    );
    expect(await page.notebook.getCellTextInput(0)).toBe(`${CONTENT}\n`);
  });
});
