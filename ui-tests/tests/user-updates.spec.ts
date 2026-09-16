/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';

import { openChat, USER } from './test-utils';

const FILENAME = 'user-updates.chat';

// A non-bot user added to the chat *after* the client connects -- the shape an
// AI persona registers once it is initialized. `display_name` has no spaces so
// the mention name is exactly `@seconduser` in every JupyterLab version.
const ADDED_USER = {
  username: 'seconduser',
  name: 'seconduser',
  display_name: 'seconduser',
  initials: 'S'
};

/**
 * Add a user to a live chat via the test-only server endpoint, which calls
 * `chat.set_user()` server-side. Transport-agnostic (works with and without RTC).
 */
async function addUser(
  page: IJupyterLabPageFixture,
  path: string,
  user: Record<string, unknown>
): Promise<void> {
  const status = await page.evaluate(
    async ({ path, user }) => {
      const settings = (window.jupyterapp as any).serviceManager.serverSettings;
      const url = settings.baseUrl + 'chat-test/add-user';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (settings.token) {
        headers['Authorization'] = 'token ' + settings.token;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path, user })
      });
      return response.status;
    },
    { path, user }
  );
  expect(status).toBe(200);
}

// Not tagged @collaborative or @websocket: this runs in every CI leg. The user
// list must update live whether chat is backed by the RTC-free WebSocket or by
// real-time collaboration.
test.describe('#user-updates', () => {
  test.use({ mockUser: USER });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('a user added after the client connects appears in the user list', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const chatCommandName = page.locator('.jp-chat-command-name');
    const addedMention = chatCommandName.filter({ hasText: '@seconduser' });

    // Baseline: the user is not known before it is added.
    await input.fill('');
    await input.press('@');
    await expect(addedMention).toHaveCount(0);

    // Add the user server-side, after the client is already connected.
    await addUser(page, FILENAME, ADDED_USER);

    // The client's user list updates live: the new user becomes mentionable.
    // Re-open the completer on each attempt so it re-queries the (async-updated)
    // user list until the update has propagated.
    await expect(async () => {
      await input.fill('');
      await input.press('@');
      await expect(addedMention).toHaveCount(1, { timeout: 1000 });
    }).toPass({ timeout: 15000 });
  });
});
