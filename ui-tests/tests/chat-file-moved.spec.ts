/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';

import { openChat } from './test-utils';

const OLD_PATH = 'chat-file-moved.chat';
const NEW_PATH = 'chat-file-moved-renamed.chat';
const MSG1 = 'first message';
const MSG2 = 'second message';

/**
 * Read and parse a .chat file from disk via the ContentsManager.
 */
const readChat = async (page: any, path: string): Promise<any> => {
  return page.evaluate(async (p: string) => {
    const model = await window.jupyterapp.serviceManager.contents.get(p, {
      content: true,
      type: 'file',
      format: 'text'
    });
    return JSON.parse(model.content);
  }, path);
};

const sendInto = async (panel: any, content: string) => {
  const input = panel.locator('.jp-chat-input-container').getByRole('combobox');
  await input.pressSequentially(content);
  await panel.locator('.jp-chat-input-container .jp-chat-send-button').click();
};

test.describe('#chatFileMoved', () => {
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.contents.uploadContent('{}', 'text', OLD_PATH);
  });

  test.afterEach(async ({ page }) => {
    for (const path of [OLD_PATH, NEW_PATH]) {
      if (await page.filebrowser.contents.fileExists(path)) {
        await page.filebrowser.contents.deleteFile(path);
      }
    }
  });

  test('should follow an in-band move and keep working', async ({ page }) => {
    // 1. Send the first message in the new chat.
    const chatPanel = await openChat(page, OLD_PATH);
    await sendInto(chatPanel, MSG1);
    await expect(
      chatPanel.locator('.jp-chat-messages-container .jp-chat-message')
    ).toHaveCount(1);

    // 2. It is saved to disk at the current (old) path.
    await page.waitForCondition(async () => {
      const content = await readChat(page, OLD_PATH);
      return content.messages?.length === 1;
    });
    const beforeMove = await readChat(page, OLD_PATH);
    expect(beforeMove.messages[0].body).toBe(MSG1);

    // 3. Move the chat via the ContentsManager (in-band, NOT an out-of-band mv).
    await page.evaluate(
      async ({ oldPath, newPath }) => {
        await window.jupyterapp.serviceManager.contents.rename(
          oldPath,
          newPath
        );
      },
      { oldPath: OLD_PATH, newPath: NEW_PATH }
    );

    // 4. Send another message; the chat still works and shows both messages.
    const movedPanel = await openChat(page, NEW_PATH);
    await sendInto(movedPanel, MSG2);
    await expect(
      movedPanel.locator('.jp-chat-messages-container .jp-chat-message')
    ).toHaveCount(2);

    // 5. Nothing is (re)created at the old path: the file is gone.
    expect(await page.filebrowser.contents.fileExists(OLD_PATH)).toBe(false);

    // 6. Both messages are persisted at the new path.
    await page.waitForCondition(async () => {
      const content = await readChat(page, NEW_PATH);
      return content.messages?.length === 2;
    });
    const afterMove = await readChat(page, NEW_PATH);
    const bodies = afterMove.messages.map((m: any) => m.body);
    expect(bodies).toContain(MSG1);
    expect(bodies).toContain(MSG2);
  });
});
