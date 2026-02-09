/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PathExt } from '@jupyterlab/coreutils';
import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';

import { createChat, openChat, openChatToSide } from './test-utils';

const CHAT = 'drag-drop.chat';
const NOTEBOOK = 'Notebook.ipynb';
const FILE = 'File.txt';

async function dismissKernelDialog(page: IJupyterLabPageFixture) {
  try {
    await page.waitForSelector('text=Select', { timeout: 2000 });
  } catch {
    // No Select Kernel dialog appeared – safe to continue
  }
}

test.describe('#drag-drop-attachments', () => {
  let chatPath: string;

  test.beforeEach(async ({ page, tmpPath }) => {
    chatPath = PathExt.join(tmpPath, CHAT);

    await createChat(page, CHAT, false, tmpPath);

    await page.filebrowser.contents.uploadContent(
      'Testing drag and drop',
      'text',
      PathExt.join(tmpPath, FILE)
    );

    await page.filebrowser.openDirectory(tmpPath);

    await page.notebook.createNew(NOTEBOOK);
    await dismissKernelDialog(page);
    await page.activity.closeAll();
  });

  test('Should attach a file via drag & drop into chat input', async ({
    page,
    tmpPath
  }) => {
    await page.filebrowser.openDirectory(tmpPath);
    const chatPanel = await openChat(page, chatPath);

    const fileItem = page
      .locator('.jp-DirListing-item')
      .filter({ hasText: FILE })
      .locator('.jp-DirListing-itemText')
      .first();
    await expect(fileItem).toBeVisible();

    const input = chatPanel.locator('.jp-chat-input-container');

    const fileBox = await fileItem.boundingBox();
    const inputBox = await input.boundingBox();

    await page.mouse.move(fileBox!.x + 5, fileBox!.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(50);

    await page.mouse.move(inputBox!.x + inputBox!.width / 2, inputBox!.y + 10);
    await page.mouse.up();

    const attachments = input.locator('.jp-chat-attachment');
    await expect(attachments).toHaveCount(1);
    await expect(attachments.first()).toHaveText(FILE);
  });

  test('Should attach notebook cell via drag & drop into chat input', async ({
    page
  }) => {
    await page.notebook.open(NOTEBOOK);
    await page.notebook.setCell(
      0,
      'code',
      'print("Hello from drag and drop test")'
    );

    const cell = page.locator('.jp-Cell').first();
    await expect(cell).toBeVisible();

    const prompt = cell.locator('.jp-InputPrompt');
    await expect(prompt).toBeVisible();

    const cellBox = await prompt.boundingBox();
    expect(cellBox).not.toBeNull();

    const chatPanel = await openChatToSide(page, chatPath);
    const input = chatPanel.locator('.jp-chat-input-container');
    await expect(input).toBeVisible();

    await page.activity.activateTab(CHAT);

    const inputBox = await input.boundingBox();
    expect(inputBox).not.toBeNull();

    await page.mouse.move(cellBox!.x + 10, cellBox!.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(50);

    await page.mouse.move(inputBox!.x + inputBox!.width / 2, inputBox!.y + 10);
    await page.mouse.up();

    const attachments = input.locator('.jp-chat-attachment');
    await expect(attachments).toHaveCount(1);
    await expect(attachments.first()).toContainText(NOTEBOOK);
  });

  //   Should be coome in work after https://github.com/jupyterlab/jupyter-chat/pull/338
  test.skip('Should attach a file via drag & drop into edit message input', async ({
    page
  }) => {
    const chatPanel = await openChat(page, chatPath);
    const input = chatPanel.locator('.jp-chat-input-container');

    await input.getByRole('combobox').fill('Hello chat');
    await input.locator('.jp-chat-send-button').click();

    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    await message.locator('[aria-label="Edit message"]').click();

    const editInput = chatPanel.locator(
      '.jp-chat-edit-container .jp-chat-input-container'
    );

    const fileItem = page
      .locator('.jp-DirListing-item')
      .filter({ hasText: FILE })
      .locator('.jp-DirListing-itemText')
      .first();
    await expect(fileItem).toBeVisible();

    const fileBox = await fileItem.boundingBox();
    const editBox = await editInput.boundingBox();

    await page.mouse.move(fileBox!.x + 5, fileBox!.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(50);

    await page.mouse.move(editBox!.x + editBox!.width / 2, editBox!.y + 10);
    await page.mouse.up();

    const attachments = editInput.locator('.jp-chat-attachment');
    await expect(attachments).toHaveCount(1);
    await expect(attachments.first()).toHaveText(FILE);
  });

  //   Should be come in work after https://github.com/jupyterlab/jupyter-chat/pull/338
  test.skip('Should attach notebook cell via drag & drop into edit message input', async ({
    page
  }) => {
    const chatPanel = await openChatToSide(page, chatPath);
    const input = chatPanel.locator('.jp-chat-input-container');

    await input.getByRole('combobox').fill('Hello chat');
    await input.locator('.jp-chat-send-button').click();

    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    await message.locator('[aria-label="Edit message"]').click();

    const editInput = chatPanel.locator(
      '.jp-chat-edit-container .jp-chat-input-container'
    );

    const editBox = await editInput.boundingBox();
    expect(editBox).not.toBeNull();

    await page.notebook.open(NOTEBOOK);
    await page.notebook.setCell(
      0,
      'code',
      'print("Hello from drag and drop test while editing message")'
    );

    const cell = page.locator('.jp-Cell').first();
    await expect(cell).toBeVisible();

    const prompt = cell.locator('.jp-InputPrompt');
    await expect(prompt).toBeVisible();

    const cellBox = await prompt.boundingBox();
    expect(cellBox).not.toBeNull();

    await page.mouse.move(cellBox!.x + 10, cellBox!.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(50);

    await page.mouse.move(editBox!.x + editBox!.width / 2, editBox!.y + 10);
    await page.mouse.up();

    const attachments = editInput.locator('.jp-chat-attachment');
    await expect(attachments).toHaveCount(1);
    await expect(attachments.first()).toContainText(NOTEBOOK);
  });
});
