/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, galata, test } from '@jupyterlab/galata';
import { Locator } from '@playwright/test';

import {
  openChat,
  openChatToSide,
  openSettings,
  openSidePanel
} from './test-utils';

const FILENAME = 'my-chat.chat';

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
      await expect(items.first()).toHaveClass(/.jp-lab-chat-add/);
      await expect(items.last()).toHaveClass(/.jp-lab-chat-open/);
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
    let addButton: Locator;

    test.beforeEach(async ({ page }) => {
      panel = await openSidePanel(page);
      addButton = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-add'
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
      await expect(chatTitle).toHaveClass(/lm-mod-expanded/);
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

    test('should reveal the existing chat when creating again', async ({
      page
    }) => {
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

      // Collapse the chat.
      await chatTitle.click();
      await expect(chatTitle).not.toHaveClass(/lm-mod-expanded/);

      await addButton.click();

      // try to recreate the same chat.
      dialog = page.locator('.jp-Dialog');
      await dialog.waitFor();
      await dialog.locator('input[type="text"]').pressSequentially(name);
      await dialog.getByRole('button').getByText('Ok').click();

      // the chat should be expanded.
      await expect(chatTitle).toHaveClass(/lm-mod-expanded/);
    });
  });

  test.describe('#openingClosing', () => {
    test.use({ autoGoto: false });

    const name = FILENAME.replace('.chat', '');
    const NEW_DIR = 'chats_dir';
    let panel: Locator;
    let select: Locator;

    test.beforeEach(async ({ page }) => {
      await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
      await page.waitForCondition(
        async () => await page.filebrowser.contents.fileExists(FILENAME)
      );
      await page.goto();
    });

    test.afterEach(async ({ page }) => {
      await page.filebrowser.contents.deleteFile(FILENAME);
      if (await page.filebrowser.contents.directoryExists(NEW_DIR)) {
        await page.filebrowser.contents.deleteDirectory(NEW_DIR);
      }
    });

    test('should list existing chat', async ({ page }) => {
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-open select'
      );

      await expect(select.locator('option')).toHaveCount(2);
      await expect(select.locator('option').last()).toHaveText(name);
    });

    test('should attach a spinner while loading the chat', async ({ page }) => {
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-open select'
      );
      await select.selectOption(name);
      await expect(panel.locator('.jp-Spinner')).toBeAttached();
      await expect(panel.locator('.jp-Spinner')).not.toBeAttached();
    });

    test('should open an existing chat and close it', async ({ page }) => {
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-open select'
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

    test('should list existing chat in default directory', async ({ page }) => {
      panel = await openSidePanel(page);
      select = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-open select'
      );

      // changing the default directory to an empty one should empty the list.
      const settings = await openSettings(page);
      const defaultDirectory = settings.locator(
        'input[label="defaultDirectory"]'
      );
      await defaultDirectory.pressSequentially(NEW_DIR);

      // wait for the settings to be saved
      await expect(page.activity.getTabLocator('Settings')).toHaveAttribute(
        'class',
        /jp-mod-dirty/
      );
      await expect(page.activity.getTabLocator('Settings')).not.toHaveAttribute(
        'class',
        /jp-mod-dirty/
      );

      await expect(select.locator('option')).toHaveCount(1);
      await expect(select.locator('option').last()).toHaveText('Open a chat');

      // creating a chat should populate the list.
      const addButton = panel.locator(
        '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-add'
      );
      await addButton.click();
      const dialog = page.locator('.jp-Dialog');
      await dialog.waitFor();
      await dialog.locator('input[type="text"]').pressSequentially('new-chat');
      await dialog.getByRole('button').getByText('Ok').click();

      await expect(select.locator('option')).toHaveCount(2);
      await expect(select.locator('option').last()).toHaveText('new-chat');

      // Changing the default directory (to root) should update the chat list.
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

      await expect(select.locator('option')).toHaveCount(2);
      await expect(select.locator('option').last()).toHaveText(name);
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

      const sidePanel = page.locator('.jp-SidePanel.jp-lab-chat-sidepanel');
      await expect(sidePanel).toBeVisible();
      const chatTitle = sidePanel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(FILENAME.split('.')[0]);
    });

    test('should reveal the existing chat in side panel when moving again', async ({
      page
    }) => {
      let chatPanel = await openChat(page, FILENAME);
      const button = chatPanel.getByTitle('Move the chat to the side panel');
      await button.click();
      await expect(chatPanel).not.toBeAttached();

      const sidePanel = page.locator('.jp-SidePanel.jp-lab-chat-sidepanel');
      await expect(sidePanel).toBeVisible();
      const chatTitle = sidePanel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(chatTitle).toHaveCount(1);
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(FILENAME.split('.')[0]);

      await chatTitle.click();
      await expect(chatTitle).not.toHaveClass(/lm-mod-expanded/);

      chatPanel = await openChat(page, FILENAME);
      await button.click();
      await expect(chatPanel).not.toBeAttached();
      await expect(chatTitle).toHaveClass(/lm-mod-expanded/);
    });

    test('chat section should contain the file path', async ({ page }) => {
      // Create a nested chat file and open it.
      const dirName = 'my-dir';
      const nestedPath = [dirName, FILENAME].join('/');
      await page.filebrowser.contents.createDirectory(dirName);
      await page.filebrowser.contents.uploadContent('{}', 'text', nestedPath);

      const chatPanel = await openChat(page, nestedPath);
      const button = chatPanel.getByTitle('Move the chat to the side panel');
      await button.click();
      await expect(chatPanel).not.toBeAttached();

      // Move the chat to the side panel.
      const sidePanel = page.locator('.jp-SidePanel.jp-lab-chat-sidepanel');
      await expect(sidePanel).toBeVisible();
      const chatTitle = sidePanel.locator(
        '.jp-SidePanel-content .jp-AccordionPanel-title'
      );
      await expect(
        chatTitle.locator('.lm-AccordionPanel-titleLabel')
      ).toHaveText(nestedPath.split('.')[0]);
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
