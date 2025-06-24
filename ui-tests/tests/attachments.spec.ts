/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { PathExt } from '@jupyterlab/coreutils';
import { expect, test } from '@jupyterlab/galata';

import { createChat, exposeDepsJs, getPlugin, openChat } from './test-utils';

const CHAT = 'attachments.chat';
const NOTEBOOK = 'test.ipynb';

test.describe('#attachments', () => {
  let chatPath: string;
  test.beforeEach(async ({ page, tmpPath }) => {
    chatPath = PathExt.join(tmpPath, CHAT);

    // Create a chat, a notebook and a markdown file.
    await createChat(page, CHAT, false, tmpPath);
    await page.menu.clickMenuItem('File>New>Markdown File');
    await page.notebook.createNew(NOTEBOOK);

    // Wait for the notebook to be ready before closing it to avoid popup
    await page.waitForCondition(
      async () => (await page.locator('li.jp-mod-dirty').count()) === 1
    );
    await page.waitForCondition(
      async () => (await page.locator('li.jp-mod-dirty').count()) === 0
    );
    await page.activity.closeAll();
  });

  test('Should have a button to attach a file', async ({ page }) => {
    const chatPanel = await openChat(page, chatPath);
    const button = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-attach-button'
    );
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test('Should open a dialog on click', async ({ page }) => {
    const chatPanel = await openChat(page, chatPath);
    const button = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-attach-button'
    );
    await button.click();
    await page.waitForSelector('.jp-Dialog');
    await expect(page.locator('.jp-Dialog .jp-Dialog-header')).toHaveText(
      'Select files to attach'
    );
  });

  test('Should add attachments to input and open it', async ({
    page,
    tmpPath
  }) => {
    const chatPanel = await openChat(page, chatPath);
    const input = chatPanel.locator('.jp-chat-input-container');

    // Open the attachment dialog.
    await input.locator('.jp-chat-attach-button').click();
    await page.waitForSelector('.jp-Dialog');
    const items = page.locator('.jp-Dialog .jp-DirListing-item');

    // Open the temp directory in dialog, select the files and validate.
    await items.first().locator('.jp-DirListing-itemName').dblclick();
    await page.waitForCondition(
      async () =>
        (await items
          .first()
          .locator('.jp-DirListing-itemName')
          .textContent()) !== tmpPath
    );
    for (let i = 1; i < 3; i++) {
      const checkbox = items.nth(i).locator('input[type="checkbox"]');
      const box = await checkbox.boundingBox();
      await page.mouse.move(box!.x + 5, box!.y + 5);
      await items.nth(i).locator('input[type="checkbox"]').click();
    }
    await page.locator('.jp-Dialog button.jp-mod-accept').click();

    // Should have attachment in input
    const attachments = input.locator('.jp-chat-attachment');
    await expect(attachments).toHaveCount(2);
    await expect(attachments.nth(0)).toHaveText(
      PathExt.join(tmpPath, NOTEBOOK)
    );
    await expect(attachments.nth(1)).toHaveText(
      PathExt.join(tmpPath, 'untitled.md')
    );

    // Should open attachment file from input
    await attachments.nth(1).locator('.jp-chat-attachment-clickable').click();
    await page.waitForCondition(
      async () => await page.activity.isTabActive('untitled.md')
    );
  });

  test('Should add attachments to message and open it', async ({
    page,
    tmpPath
  }) => {
    const chatPanel = await openChat(page, chatPath);
    const input = chatPanel.locator('.jp-chat-input-container');

    // Open the attachment dialog.
    await input.locator('.jp-chat-attach-button').click();
    await page.waitForSelector('.jp-Dialog');
    const items = page.locator('.jp-Dialog .jp-DirListing-item');

    // Open the temp directory in dialog, select the files and validate.
    await items.first().locator('.jp-DirListing-itemName').dblclick();
    await page.waitForCondition(
      async () =>
        (await items
          .first()
          .locator('.jp-DirListing-itemName')
          .textContent()) !== tmpPath
    );
    for (let i = 1; i < 3; i++) {
      const checkbox = items.nth(i).locator('input[type="checkbox"]');
      const box = await checkbox.boundingBox();
      await page.mouse.move(box!.x + 5, box!.y + 5);
      await items.nth(i).locator('input[type="checkbox"]').click();
    }
    await page.locator('.jp-Dialog button.jp-mod-accept').click();

    // Send the message
    await input.locator('.jp-chat-send-button').click();

    // Should have attachment in message
    const message = chatPanel
      .locator('.jp-chat-messages-container .jp-chat-message')
      .first();
    const attachments = message.locator('.jp-chat-attachment');
    await expect(attachments).toHaveCount(2);
    await expect(attachments.nth(0)).toHaveText(
      PathExt.join(tmpPath, NOTEBOOK)
    );
    await expect(attachments.nth(1)).toHaveText(
      PathExt.join(tmpPath, 'untitled.md')
    );

    // Should open attachment file from input
    await attachments.nth(1).locator('.jp-chat-attachment-clickable').click();
    await page.waitForCondition(
      async () => await page.activity.isTabActive('untitled.md')
    );
  });
});

test.describe('#attachmentOpenerRegistry', () => {
  test.use({ autoGoto: false });

  test('Should have change the callback', async ({ page, tmpPath }) => {
    const logs: string[] = [];

    page.on('console', message => {
      logs.push(message.text());
    });

    await page.goto();

    // Expose a function to get a plugin.
    await page.evaluate(exposeDepsJs({ getPlugin }));

    // Modify the behavior on attachment click.
    await page.evaluate(async () => {
      // change the registered callback on attachment click.
      const registry = await window.getPlugin(
        'jupyterlab-chat-extension:attachmentOpener'
      );
      registry.set('file', attachment =>
        console.log(`Attached file: ${attachment.value}`)
      );
    });

    const chatPath = PathExt.join(tmpPath, CHAT);
    await createChat(page, CHAT, false, tmpPath);
    const chatPanel = await openChat(page, chatPath);

    const input = chatPanel.locator('.jp-chat-input-container');

    // Open the attachment dialog.
    await input.locator('.jp-chat-attach-button').click();
    await page.waitForSelector('.jp-Dialog');
    // Open the temp directory in dialog, select the file and validate.
    await page.locator('.jp-Dialog .jp-DirListing-itemName').first().dblclick();
    await page.locator('.jp-Dialog .jp-DirListing-itemName').last().click();
    await page.locator('.jp-Dialog button.jp-mod-accept').click();

    // Click on the attachment and expect a log.
    const attachment = input.locator('.jp-chat-attachment').first();
    await attachment.locator('.jp-chat-attachment-clickable').click();
    expect(logs.filter(s => s === `Attached file: ${chatPath}`)).toHaveLength(
      1
    );
  });
});
