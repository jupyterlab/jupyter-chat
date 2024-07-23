/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, test } from '@jupyterlab/galata';

import { openChat } from './test-utils';

const FILENAME = 'my-chat.chat';
const opener = '?';
const commands = ['?test', '?other-test', '?last-test'];

// Workaround to expose a function using 'window' in the browser context.
// Copied from https://github.com/puppeteer/puppeteer/issues/724#issuecomment-896755822
const exposeDepsJs = (deps: Record<string, (...args: any) => any>): string => {
  return Object.keys(deps)
    .map(key => {
      return `window["${key}"] = ${deps[key]};`;
    })
    .join('\n');
};

// The function running in browser context to get a plugin.
const getPlugin = (pluginId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const app = window.jupyterapp;
    const hasPlugin = app.hasPlugin(pluginId);

    if (hasPlugin) {
      try {
        const appAny = app as any;
        const plugin: any = appAny._plugins
          ? appAny._plugins.get(pluginId)
          : undefined;
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

test.beforeEach(async ({ page }) => {
  // Expose a function to get a plugin.
  await page.evaluate(exposeDepsJs({ getPlugin }));

  // Create a chat file
  await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
});

test.afterEach(async ({ page }) => {
  if (await page.filebrowser.contents.fileExists(FILENAME)) {
    await page.filebrowser.contents.deleteFile(FILENAME);
  }
});

test.describe('#autocompletionRegistry', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(
      async options => {
        // register a basic autocompletion object in registry.
        const registry = await window.getPlugin(
          'jupyterlab-collaborative-chat:autocompletionRegistry'
        );

        registry.removeAll();

        const autocompletion = {
          opener: options.opener,
          commands: async () =>
            options.commands.map(str => ({
              label: str,
              id: str.replace('?', '')
            }))
        };
        registry.add('test-completion', autocompletion, true);
      },
      { opener, commands }
    );
  });

  test('should open autocompletion with opener string', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');
    // Autocompletion should no be attached by default.
    await expect(completionPopup).not.toBeAttached();

    // Autocompletion should no be attached with other character than the opener.
    await input.fill('/');
    await expect(completionPopup).not.toBeAttached();

    // Autocompletion should no be attached with opener character.
    await input.fill(opener);
    await expect(completionPopup).toBeAttached();

    // The autocompletion should be closed when removing opener string.
    await input.press('Backspace');
    await expect(completionPopup).not.toBeAttached();
  });

  test('autocompletion should contain correct tags', async ({ page }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');
    // Autocompletion should no be attached by default.
    await expect(completionPopup).not.toBeAttached();

    // Autocompletion should no be attached with opener character.
    await input.fill(opener);
    await expect(completionPopup).toBeAttached();

    const options = completionPopup.locator('.MuiAutocomplete-option');
    await expect(options).toHaveCount(3);
    for (let i = 0; i < (await options.count()); i++) {
      await expect(options.nth(i)).toHaveText(commands[i]);
    }
  });

  test('should open autocompletion with a tag highlighted', async ({
    page
  }) => {
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');

    // Autocompletion should no be attached with opener character.
    await input.fill(opener);
    await expect(completionPopup).toBeAttached();
    await expect(completionPopup.locator('.Mui-focused')).toHaveCount(1);
  });

  test('should remove autocompletion from registry', async ({ page }) => {
    await page.evaluate(
      async options => {
        const registry = await window.getPlugin(
          'jupyterlab-collaborative-chat:autocompletionRegistry'
        );
        registry.remove('test-completion');
      },
      { opener, commands }
    );
    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');

    // Autocompletion should not be attached with opener character.
    await input.fill(opener);
    await expect(completionPopup).not.toBeAttached();
  });

  test('should change the default completion when adding a new default', async ({
    page
  }) => {
    const newOpener = '/';
    await page.evaluate(
      async options => {
        const registry = await window.getPlugin(
          'jupyterlab-collaborative-chat:autocompletionRegistry'
        );
        const autocompletion = {
          opener: options.newOpener,
          commands: async () =>
            options.commands.map(str => ({
              label: str.replace('?', '/'),
              id: str.replace('?', '')
            }))
        };
        registry.add('test-completion-other', autocompletion, true);
      },
      { newOpener, commands }
    );

    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');

    // Autocompletion should not be attached with the previous opener character.
    await input.fill(opener);
    await expect(completionPopup).not.toBeAttached();

    await input.fill(newOpener);
    await expect(completionPopup).toBeAttached();

    const options = completionPopup.locator('.MuiAutocomplete-option');
    await expect(options).toHaveCount(3);
    for (let i = 0; i < (await options.count()); i++) {
      await expect(options.nth(i)).toHaveText(commands[i].replace('?', '/'));
    }
  });

  test('should not add autocompletion with the same name', async ({ page }) => {
    const newOpener = '/';
    const added = await page.evaluate(
      async options => {
        const registry = await window.getPlugin(
          'jupyterlab-collaborative-chat:autocompletionRegistry'
        );
        const autocompletion = {
          opener: options.newOpener,
          commands: async () =>
            options.commands.map(str => ({
              label: str.replace('?', '/'),
              id: str.replace('?', '')
            }))
        };
        return registry.add('test-completion', autocompletion, true);
      },
      { newOpener, commands }
    );

    expect(added).toBe(false);

    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');

    // Autocompletion should be attached with the previous opener character.
    await input.fill(opener);
    await expect(completionPopup).toBeAttached();
  });

  test('should not change the default completion when adding a non default', async ({
    page
  }) => {
    const newOpener = '/';
    await page.evaluate(
      async options => {
        const registry = await window.getPlugin(
          'jupyterlab-collaborative-chat:autocompletionRegistry'
        );
        const autocompletion = {
          opener: options.newOpener,
          commands: async () =>
            options.commands.map(str => ({
              label: str.replace('?', '/'),
              id: str.replace('?', '')
            }))
        };
        registry.add('test-completion-other', autocompletion, false);
      },
      { newOpener, commands }
    );

    const chatPanel = await openChat(page, FILENAME);
    const input = chatPanel
      .locator('.jp-chat-input-container')
      .getByRole('combobox');
    const completionPopup = page.locator('.MuiAutocomplete-popper');

    // Autocompletion should be attached with the previous opener character.
    await input.fill(opener);
    await expect(completionPopup).toBeAttached();
  });
});

test('should use properties from autocompletion object', async ({ page }) => {
  await page.evaluate(
    async options => {
      const registry = await window.getPlugin(
        'jupyterlab-collaborative-chat:autocompletionRegistry'
      );
      registry.removeAll();
      const autocompletion = {
        opener: options.opener,
        commands: async () =>
          options.commands.map(str => ({
            label: str,
            id: str.replace('?', '')
          })),
        props: {
          autoHighlight: false
        }
      };
      registry.add('test-completion', autocompletion, true);
    },
    { opener, commands }
  );

  const chatPanel = await openChat(page, FILENAME);
  const input = chatPanel
    .locator('.jp-chat-input-container')
    .getByRole('combobox');
  const completionPopup = page.locator('.MuiAutocomplete-popper');

  // There should be no highlighted option.
  await input.fill(opener);
  await expect(completionPopup).toBeAttached();
  await expect(completionPopup.locator('.Mui-focused')).toHaveCount(0);
});

test('single autocompletion should be the default', async ({ page }) => {
  await page.evaluate(
    async options => {
      const registry = await window.getPlugin(
        'jupyterlab-collaborative-chat:autocompletionRegistry'
      );
      registry.removeAll();
      const autocompletion = {
        opener: options.opener,
        commands: async () =>
          options.commands.map(str => ({
            label: str,
            id: str.replace('?', '')
          }))
      };
      registry.add('test-completion', autocompletion, false);
    },
    { opener, commands }
  );

  const chatPanel = await openChat(page, FILENAME);
  const input = chatPanel
    .locator('.jp-chat-input-container')
    .getByRole('combobox');
  const completionPopup = page.locator('.MuiAutocomplete-popper');

  // Autocompletion should be attached with the opener character.
  await input.fill(opener);
  await expect(completionPopup).toBeAttached();
});
