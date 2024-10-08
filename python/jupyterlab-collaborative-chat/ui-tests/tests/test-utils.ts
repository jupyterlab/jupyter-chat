/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IJupyterLabPageFixture } from '@jupyterlab/galata';
import { User } from '@jupyterlab/services';
import { UUID } from '@lumino/coreutils';
import { Locator } from '@playwright/test';

export const USER: User.IUser = {
  identity: {
    username: UUID.uuid4(),
    name: 'jovyan',
    display_name: 'jovyan',
    initials: 'JP',
    color: 'var(--jp-collaborator-color1)'
  },
  permissions: {}
};

export const openChat = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<Locator> => {
  const panel = await page.activity.getPanelLocator(filename);
  if (panel !== null && (await panel.count())) {
    return panel;
  }

  await page.evaluate(async filepath => {
    await window.jupyterapp.commands.execute('collaborative-chat:open', {
      filepath
    });
  }, filename);
  await page.waitForCondition(
    async () => await page.activity.isTabActive(filename)
  );
  return (await page.activity.getPanelLocator(filename)) as Locator;
};

export const openChatToSide = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<Locator> => {
  const panel = page.locator('.jp-SidePanel.jp-collab-chat-sidepanel');
  await page.evaluate(async filepath => {
    const inSidePanel = true;
    await window.jupyterapp.commands.execute('collaborative-chat:open', {
      filepath,
      inSidePanel
    });
  }, filename);
  await page.waitForCondition(() => panel.isVisible());
  return panel;
};

export const sendMessage = async (
  page: IJupyterLabPageFixture,
  filename: string,
  content: string
) => {
  const chatPanel = await openChat(page, filename);
  const input = chatPanel
    .locator('.jp-chat-input-container')
    .getByRole('combobox');
  const sendButton = chatPanel.locator(
    '.jp-chat-input-container .jp-chat-send-button'
  );
  await input.pressSequentially(content);
  await sendButton.click();
};

export const splitMainArea = async (
  page: IJupyterLabPageFixture,
  name: string
) => {
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
};

export const openSettings = async (
  page: IJupyterLabPageFixture,
  globalSettings?: boolean
): Promise<Locator> => {
  const args = globalSettings ? {} : { query: 'Chat' };
  await page.evaluate(async args => {
    await window.jupyterapp.commands.execute('settingeditor:open', args);
  }, args);

  // Activate the settings tab, sometimes it does not automatically.
  const settingsTab = page
    .getByRole('main')
    .getByRole('tab', { name: 'Settings', exact: true });
  await settingsTab.click();
  await page.waitForCondition(
    async () => (await settingsTab.getAttribute('aria-selected')) === 'true'
  );
  return (await page.activity.getPanelLocator('Settings')) as Locator;
};
