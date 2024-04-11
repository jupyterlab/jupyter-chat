/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IJupyterLabPageFixture, expect, test } from '@jupyterlab/galata';

async function fillModal(page: IJupyterLabPageFixture, text='', button: 'Ok' | 'Cancel' = 'Ok') {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').pressSequentially(text);
  await dialog.getByRole('button').filter({ hasText: button}).click();
}

test.describe('#commandPalette', () => {
  const name = 'my-chat';

  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("Control+Shift+c");
  });

  test.afterEach(async ({ page }) => {
    for (let filename of ['untitled.chat', `${name}.chat`]) {
      if (await page.filebrowser.contents.fileExists(filename)) {
        await page.filebrowser.contents.deleteFile(filename);
      }
    }
  });

  test('should have 2 commands in palette', async ({ page }) => {
    await expect(page.locator(
      '#modal-command-palette li[data-command^="collaborative-chat"]'
    )).toHaveCount(2);
  });

  test('should create a chat with name from command palette', async ({ page }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:create"]'
      )
      .click();
    await fillModal(page, name);
    await page.waitForCondition(
      async () => await page.filebrowser.contents.fileExists(`${name}.chat`)
    );
    await expect(page.activity.getTabLocator(`${name}.chat`)).toBeVisible();
  });

  test('should create an untitled chat from command palette', async ({ page }) => {
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:create"]'
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
        '#modal-command-palette li[data-command="collaborative-chat:create"]'
      )
      .click();
    await fillModal(page, '', 'Cancel');
    const tab = page.getByRole('main').getByRole('tab');
    await expect(tab).toHaveCount(1);
  });

  test('should open an existing chat', async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', `${name}.chat`);

    // open it from command palette
    await page
      .locator(
        '#modal-command-palette li[data-command="collaborative-chat:open"]'
      )
      .click();
    await fillModal(page, `${name}.chat`);
    await expect(page.activity.getTabLocator(`${name}.chat`)).toBeVisible();
  });
});
