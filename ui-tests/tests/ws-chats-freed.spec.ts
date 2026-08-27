/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';

import { openChat, USER } from './test-utils';
import { webSocketOnly } from './tags';

/**
 * Whether the server still holds a chat model for `path` in memory. Queries the
 * read-only test endpoint, which reports the `ChatManager` registry without
 * resurrecting a freed chat.
 */
async function isChatAlive(
  page: IJupyterLabPageFixture,
  path: string
): Promise<boolean> {
  return page.evaluate(async (path: string) => {
    const settings = (window.jupyterapp as any).serviceManager.serverSettings;
    const url =
      settings.baseUrl +
      'chat-test/chat-alive?path=' +
      encodeURIComponent(path);
    const headers: Record<string, string> = {};
    if (settings.token) {
      headers['Authorization'] = 'token ' + settings.token;
    }
    const response = await fetch(url, { headers });
    const body = await response.json();
    return body.alive as boolean;
  }, path);
}

/**
 * Ask the server to hold the chat alive with `WsChatModel.keep_alive()` for
 * `seconds`, then send a "Hi" message. Returns as soon as the background task is
 * scheduled (server-side), before it completes.
 */
async function keepAlive(
  page: IJupyterLabPageFixture,
  path: string,
  seconds: number
): Promise<void> {
  const status = await page.evaluate(
    async ({ path, seconds }) => {
      const settings = (window.jupyterapp as any).serviceManager.serverSettings;
      const url = settings.baseUrl + 'chat-test/keep-alive';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (settings.token) {
        headers['Authorization'] = 'token ' + settings.token;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path, seconds })
      });
      return response.status;
    },
    { path, seconds }
  );
  expect(status).toBe(200);
}

/**
 * Read and parse a .chat file from disk via the ContentsManager.
 */
async function readChat(
  page: IJupyterLabPageFixture,
  path: string
): Promise<any> {
  return page.evaluate(async (p: string) => {
    const model = await window.jupyterapp.serviceManager.contents.get(p, {
      content: true,
      type: 'file',
      format: 'text'
    });
    return JSON.parse(model.content);
  }, path);
}

// WebSocket-only: this exercises WsChatModel memory management. Under real-time
// collaboration the chat model lifecycle is owned by jupyter-collaboration at a
// higher layer, so these guarantees do not apply and the suite is skipped on the
// collaborative CI legs (via `--grep-invert @websocket`).
test.describe('#ws-chats-freed', webSocketOnly, () => {
  test.use({ mockUser: USER });

  test('the chat model is freed after the client closes the tab', async ({
    page
  }) => {
    const filename = 'ws-chats-freed-plain.chat';
    await page.filebrowser.contents.uploadContent('{}', 'text', filename);

    await openChat(page, filename);
    // The model is live while a client is connected.
    expect(await isChatAlive(page, filename)).toBe(true);

    // Closing the tab disconnects the only client. With no keep_alive context
    // the manager frees the model.
    await page.activity.closePanel(filename);
    await expect(async () => {
      expect(await isChatAlive(page, filename)).toBe(false);
    }).toPass({ timeout: 15000 });

    await page.filebrowser.contents.deleteFile(filename);
  });

  test('keep_alive() keeps the chat alive until the context resolves', async ({
    page
  }) => {
    const filename = 'ws-chats-freed-keepalive.chat';
    await page.filebrowser.contents.uploadContent('{}', 'text', filename);

    await openChat(page, filename);
    expect(await isChatAlive(page, filename)).toBe(true);

    // The server opens a keep_alive() context for a few seconds, then sends
    // "Hi" and exits it. This runs in the background on the server.
    await keepAlive(page, filename, 6);

    // The client leaves immediately. Without keep_alive the model would be freed
    // on this disconnect; the open context must keep it alive instead.
    await page.activity.closePanel(filename);
    expect(await isChatAlive(page, filename)).toBe(true);

    // The context body runs to completion while the chat is still alive: its
    // "Hi" message is persisted even though no client is connected.
    await expect(async () => {
      const content = await readChat(page, filename);
      const bodies = (content.messages ?? []).map((m: any) => m.body);
      expect(bodies).toContain('Hi');
    }).toPass({ timeout: 20000 });

    // Once the context resolves and the (already-gone) client is not replaced,
    // the manager reclaims the model.
    await expect(async () => {
      expect(await isChatAlive(page, filename)).toBe(false);
    }).toPass({ timeout: 20000 });

    await page.filebrowser.contents.deleteFile(filename);
  });
});
