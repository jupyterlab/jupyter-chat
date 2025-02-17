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

export const createChat = async (
  page: IJupyterLabPageFixture,
  filename: string
): Promise<void> => {
  await page.evaluate(async name => {
    await window.jupyterapp.commands.execute('jupyterlab-chat:create', {
      name
    });
  }, filename);
};

export const openChat = async (
  page: IJupyterLabPageFixture,
  filename: string,
  content?: any
): Promise<Locator> => {
  let panel = await page.activity.getPanelLocator(filename);
  if (panel !== null && (await panel.count())) {
    return panel;
  }

  await page.evaluate(async filepath => {
    await window.jupyterapp.commands.execute('jupyterlab-chat:open', {
      filepath
    });
  }, filename);
  const splitPath = filename.split('/');
  const tabName = splitPath[splitPath.length - 1];
  await page.waitForCondition(
    async () => await page.activity.isTabActive(tabName)
  );
  panel = await page.activity.getPanelLocator(tabName);

  // If a content is provided, wait for all the messages to be rendered
  if (content) {
    await page.waitForCondition(async () => {
      const expectedCount = content.messages.length;
      const currentCount = await panel
        ?.locator('.jp-chat-rendered-markdown')
        .count();
      const currentBodies = await panel
        ?.locator('.jp-chat-rendered-markdown')
        .allTextContents();
      return (
        expectedCount === currentCount &&
        currentBodies!.every(value => value !== '')
      );
    });
  }
  return panel as Locator;
};

export const openChatToSide = async (
  page: IJupyterLabPageFixture,
  filename: string,
  content?: any
): Promise<Locator> => {
  const panel = page.locator('.jp-SidePanel.jp-lab-chat-sidepanel');
  await page.evaluate(async filepath => {
    const inSidePanel = true;
    await window.jupyterapp.commands.execute('jupyterlab-chat:open', {
      filepath,
      inSidePanel
    });
  }, filename);
  await page.waitForCondition(() => panel.isVisible());

  // If a content is provided, wait for all the messages to be rendered
  if (content) {
    await page.waitForCondition(async () => {
      const expectedCount = content.messages.length;
      const currentCount = await panel
        ?.locator('.jp-chat-rendered-markdown')
        .count();
      const currentBodies = await panel
        ?.locator('.jp-chat-rendered-markdown')
        .allTextContents();
      return (
        expectedCount === currentCount &&
        currentBodies!.every(value => value !== '')
      );
    });
  }
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

export const openSidePanel = async (
  page: IJupyterLabPageFixture
): Promise<Locator> => {
  const panel = page.locator('.jp-SidePanel.jp-lab-chat-sidepanel');

  if (!(await panel?.isVisible())) {
    const chatIcon = page.locator('.jp-SideBar').getByTitle('Jupyter Chat');
    await chatIcon.click();
    page.waitForCondition(async () => await panel.isVisible());
  }
  return panel.first();
};

// Workaround to expose a function using 'window' in the browser context.
// Copied from https://github.com/puppeteer/puppeteer/issues/724#issuecomment-896755822
export const exposeDepsJs = (
  deps: Record<string, (...args: any) => any>
): string => {
  return Object.keys(deps)
    .map(key => {
      return `window["${key}"] = ${deps[key]};`;
    })
    .join('\n');
};

/**
 * The function running in browser context to get a plugin.
 *
 * This function does the same as the equivalent in InPage galata helper, without the
 * constraint on the plugin id.
 */
export const getPlugin = (pluginId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const app = window.jupyterapp as any;
    const hasPlugin = app.hasPlugin(pluginId);

    if (hasPlugin) {
      try {
        // Compatibility with jupyterlab 4.3
        const plugin: any = app._plugins
          ? app._plugins.get(pluginId)
          : app.pluginRegistry._plugins.get(pluginId);
        if (plugin.activated) {
          resolve(plugin.service);
        } else {
          void app.activatePlugin(pluginId).then(response => {
            resolve(plugin.service);
          });
        }
      } catch (error) {
        console.error('Failed to get plugin', error);
      }
    }
  });
};
