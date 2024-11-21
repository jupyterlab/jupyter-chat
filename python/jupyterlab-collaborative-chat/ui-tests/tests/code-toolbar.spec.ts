/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';

import { openChat, sendMessage, splitMainArea, USER } from './test-utils';

test.use({
  mockUser: USER,
  mockSettings: {
    ...galata.DEFAULT_SETTINGS,
    'jupyterlab-chat-extension:factory': {
      sendWithShiftEnter: true
    }
  }
});

const FILENAME = 'toolbar.chat';
const CONTENT = 'print("This is a code cell")';
const MESSAGE = `\`\`\`\n${CONTENT}\n\`\`\``;

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

  test('replace active cell content', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item');

    const notebook = await page.notebook.createNew();
    // write content in the first cell.
    const cell = await page.notebook.getCellLocator(0);
    await cell?.getByRole('textbox').pressSequentially('initial content');

    await sendMessage(page, FILENAME, MESSAGE);
    await splitMainArea(page, notebook!);

    await expect(toolbarButtons.nth(2)).toHaveAccessibleName(
      'Replace selection (active cell)'
    );
    await toolbarButtons.nth(2).click();

    await page.activity.activateTab(notebook!);
    await page.waitForCondition(
      async () =>
        (await page.notebook.getCellTextInput(0)) !== 'initial content'
    );
    expect(await page.notebook.getCellTextInput(0)).toBe(`${CONTENT}\n`);
  });

  test('replace current selection', async ({ page }) => {
    const cellContent = 'a = 1\nprint(f"a={a}")';
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item');

    const notebook = await page.notebook.createNew();
    // write content in the first cell.
    const cell = (await page.notebook.getCellLocator(0))!;
    await cell.getByRole('textbox').pressSequentially(cellContent);

    // wait for code mirror to be ready.
    await expect(cell.locator('.cm-line')).toHaveCount(2);
    await expect(
      cell.locator('.cm-line').nth(1).locator('.cm-builtin')
    ).toBeAttached();

    // select the 'print' statement in the second line.
    const selection = cell
      ?.locator('.cm-line')
      .nth(1)
      .locator('.cm-builtin')
      .first();
    await selection.dblclick({ position: { x: 10, y: 10 } });

    await sendMessage(page, FILENAME, MESSAGE);
    await splitMainArea(page, notebook!);

    await expect(toolbarButtons.nth(2)).toHaveAccessibleName(
      'Replace selection (1 line(s))'
    );
    await toolbarButtons.nth(2).click();

    await page.activity.activateTab(notebook!);
    await page.waitForCondition(
      async () => (await page.notebook.getCellTextInput(0)) !== cellContent
    );
    expect(await page.notebook.getCellTextInput(0)).toBe(
      `a = 1\n${CONTENT}\n(f"a={a}")`
    );
  });

  test('should copy code content', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const message = chatPanel.locator('.jp-chat-message');
    const toolbarButtons = message.locator('.jp-chat-code-toolbar-item');

    const notebook = await page.notebook.createNew();

    await sendMessage(page, FILENAME, MESSAGE);

    // Copy the message code content to clipboard.
    await toolbarButtons.last().click();

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${CONTENT}\n`
    );

    await page.activity.activateTab(notebook!);
    const cell = await page.notebook.getCellLocator(0);
    await cell?.getByRole('textbox').press('Control+V');
    await page.waitForCondition(
      async () => (await page.notebook.getCellTextInput(0)) !== ''
    );
    expect(await page.notebook.getCellTextInput(0)).toBe(`${CONTENT}\n`);
  });
});
