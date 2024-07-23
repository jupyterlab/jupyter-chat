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

export const sendMessage = async (
  page: IJupyterLabPageFixture,
  filename: string,
  content: string
) => {
  const chatPanel = await openChat(page, filename);
  const input = chatPanel
    .locator('.jp-chat-input-container')
    .getByRole('combobox');
  const sendButton = chatPanel
    .locator('.jp-chat-input-container')
    .getByRole('button');
  await input.pressSequentially(content);
  await sendButton.click();
};
