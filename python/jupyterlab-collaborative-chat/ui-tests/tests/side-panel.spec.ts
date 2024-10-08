/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test
} from '@jupyterlab/galata';
import { Locator } from '@playwright/test';

import { openChat, openChatToSide } from './test-utils';

const FILENAME = 'my-chat.chat';

const openSidePanel = async (
  page: IJupyterLabPageFixture
): Promise<Locator> => {
  const panel = page.locator('.jp-SidePanel.jp-collab-chat-sidepanel');

  if (!(await panel?.isVisible())) {
    const chatIcon = page.getByTitle('Jupyter Chat');
    await chatIcon.click();
    await expect(panel).toBeVisible();
  }
  return panel.first();
};

test.describe('#sidepanel', () => {
  test.describe('#initialization', () => {
    test('should contain the chat panel icon', async ({ page }) => {
      const chatIcon = page.getByTitle('Jupyter Chat');
      expect(chatIcon).toHaveCount(1);
      expect(await chatIcon.screenshot()).toMatchSnapshot('chat_icon.png');
    });

    test('chat panel should contain a toolbar', async ({ page }) => {
      const panel = await openSidePanel(page);
      const toolbar = panel.locator('.jp-SidePanel-toolbar');
      await expect(toolbar).toHaveCount(1);

      const items = toolbar.locator('.jp-Toolbar-item');
      await expect(items).toHaveCount(2);
      await expect(items.first()).toHaveClass(/.jp-collab-chat-add/);
      await expect(items.last()).toHaveClass(/.jp-collab-chat-open/);
    });

    test('chat panel should not contain a chat at init', async ({ page }) => {
      const panel = await openSidePanel(page);
      const content = panel.locator('.jp-SidePanel-content');
      await expect(content).toBeEmpty();
    });
  });

  test.describe('#creation', () => {
    const name = FILENAME.replace('.chat', '');
    let panel: Locator;
    let dialog: Locator;

    test.beforeEach(async ({ page }) => {
      panel = await openSidePanel(page);
      const addButton = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-add'
      );
      await addButton.click();

      dialog = page.locator('.jp-Dialog');
      await dialog.waitFor();
    });

    test.afterEach(async ({ page }) => {
      for (let filename of ['untitled.chat', FILENAME]) {
        if (await page.filebrowser.contents.fileExists(filename)) {
          await page.filebrowser.contents.deleteFile(filename);
        }
      }
    });

    test('should create a chat', async ({ page }) => {
      await dialog.locator('input[type="text"]').pressSequentially(name);
      await dialog.getByRole('button').getByText('Ok').click();
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(FILENAME)
      );

      const chatTitle = panel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(name);
    });

    test('should create an untitled file if no name is provided', async ({
      page
    }) => {
      await dialog.getByRole('button').getByText('Ok').click();
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists('untitled.chat')
      );

      const chatTitle = panel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText('untitled');
    });

    test('should not create a chat if dialog is cancelled', async () => {
      await dialog.getByRole('button').getByText('Cancel').click();

      const content = panel.locator('.jp-SidePanel-content');
      await expect(content).toBeEmpty();
    });
  });

  test.describe('#openingClosing', () => {
    const name = FILENAME.replace('.chat', '');
    let panel: Locator;
    let select: Locator;

    test.beforeEach(async ({ page }) => {
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
    });

    test.afterEach(async ({ page }) => {
      await page.filebrowser.contents.deleteFile(FILENAME);
    });

    test('should list existing chat', async ({ page }) => {
      // reload to update the chat list
      // FIX: add listener on file creation
      await page.reload();
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-open select'
      );

      await expect(select.locator('option')).toHaveCount(2);
      await expect(select.locator('option').last()).toHaveText(name);
    });

    test('should open an existing chat and close it', async ({ page }) => {
      // reload to update the chat list
      // FIX: add listener on file creation
      await page.reload();
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-collab-chat-open select'
      );

      await select.selectOption(name);

      const chatTitle = panel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(name);

      await chatTitle.getByTitle('Close the chat').click();
      await expect(chatTitle).toHaveCount(0);
    });
  });

  test.describe('#movingChat', () => {
    test.use({ mockSettings: { ...galata.DEFAULT_SETTINGS } });

    test.beforeEach(async ({ page }) => {
      // Create a chat file
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
    });

    test.afterEach(async ({ page }) => {
      if (await page.filebrowser.contents.fileExists(FILENAME)) {
        await page.filebrowser.contents.deleteFile(FILENAME);
      }
    });

    test('main widget toolbar should have a button', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Move the chat to the side panel');
      expect(button).toBeVisible();
      expect(await button.screenshot()).toMatchSnapshot('moveToSide.png');
    });

    test('chat should move to the side panel', async ({ page }) => {
      const chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Move the chat to the side panel');
      await button.click();
      await expect(chatPanel).not.toBeAttached();

      const sidePanel = page.locator('.jp-SidePanel.jp-collab-chat-sidepanel');
      await expect(sidePanel).toBeVisible();
      const chatTitle = sidePanel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(FILENAME.split('.')[0]);
    });

    test('side panel should contain a button to move the chat', async ({
      page
    }) => {
      const sidePanel = await openChatToSide(page, FILENAME);
      const chatTitle = sidePanel
        .locator('.jp-SidePanel-content .jp-AccordionPanel-title')
        .first();
      const button = chatTitle.getByTitle('Move the chat to the main area');
      expect(button).toBeVisible();
      expect(await button.screenshot()).toMatchSnapshot('moveToMain.png');
    });

    test('chat should move to the main area', async ({ page }) => {
      const sidePanel = await openChatToSide(page, FILENAME);
      const chatTitle = sidePanel
        .locator('.jp-SidePanel-content .jp-AccordionPanel-title')
        .first();
      const button = chatTitle.getByTitle('Move the chat to the main area');
      await button.click();
      expect(chatTitle).not.toBeAttached();

      await expect(page.activity.getTabLocator(FILENAME)).toBeVisible();
    });
  });
});
