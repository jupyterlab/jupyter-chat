/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { PathExt } from '@jupyterlab/coreutils';
import { expect, test } from '@jupyterlab/galata';

import {
  createChat,
  exposeDepsJs,
  getPlugin,
  openChat,
  openChatToSide
} from './test-utils';

const CHAT = 'input-toolbar.chat';

test.describe('#inputToolbar', () => {
  test('Should hide toolbar item for main area chat only', async ({
    page,
    tmpPath
  }) => {
    // Expose a function to get a plugin.
    await page.evaluate(exposeDepsJs({ getPlugin }));

    // Modify the input toolbar when a chat is opened.
    await page.evaluate(async () => {
      const tracker = await window.getPlugin(
        'jupyterlab-chat-extension:tracker'
      );

      const updateToolbar = registry => {
        registry.hide('attach');
      };

      // Should update the input toolbar of main area widgets only
      tracker.widgetAdded.connect((_, widget) => {
        if (widget.context) {
          let registry = widget.context.inputToolbarRegistry;
          if (registry) {
            updateToolbar(registry);
          }
        }
      });
    });

    const chatPath = PathExt.join(tmpPath, CHAT);
    await createChat(page, CHAT, false, tmpPath);
    const chatPanel = await openChat(page, chatPath);

    // The main area chat input should not contain the 'attach' button.
    const inputToolbar = chatPanel.locator(
      '.jp-chat-input-container .jp-chat-input-reactive-toolbar'
    );
    await expect(inputToolbar).toBeVisible();
    expect(inputToolbar.locator('.jp-chat-attach-button')).not.toBeVisible();

    // The side panel chat input should contain the 'attach' button.
    const chatSidePanel = await openChatToSide(page, chatPath);
    const inputToolbarSide = chatSidePanel.locator(
      '.jp-chat-input-container .jp-chat-input-reactive-toolbar'
    );
    await expect(inputToolbarSide).toBeVisible();
    await expect(inputToolbarSide.locator('button')).toHaveCount(2);
    expect(inputToolbarSide.locator('.jp-chat-attach-button')).toBeVisible();
  });

  test('Should overflow toolbar items into popup when toolbar is too narrow', async ({
    page,
    tmpPath
  }) => {
    await page.evaluate(exposeDepsJs({ getPlugin }));

    // Register several wide items to the side panel reactive toolbar.
    // Dynamic import of bare specifiers doesn't work in JupyterLab's module
    // federation context, so we retrieve the base lumino Widget class by
    // climbing to the root of the prototype chain (the last class before
    // Object.prototype).
    await page.evaluate(async () => {
      const tracker = await window.getPlugin(
        'jupyterlab-chat-extension:tracker'
      );

      tracker.widgetAdded.connect((_, widget) => {
        // Side panel widgets have no document context; skip main area ones.
        if (widget.context) {
          return;
        }
        const registry = widget.widget?.inputToolbarRegistry;
        if (!registry) {
          return;
        }

        // Walk to the base class (root before Object.prototype = lumino Widget).
        let cls = widget.constructor;
        while (Object.getPrototypeOf(cls.prototype) !== Object.prototype) {
          cls = Object.getPrototypeOf(cls.prototype).constructor;
        }
        const Widget = cls;

        for (let i = 1; i <= 5; i++) {
          registry.addItem(`test-overflow-${i}`, {
            createWidget: () => {
              const w = new Widget();
              w.addClass('jp-chat-test-overflow-item');
              const btn = document.createElement('button');
              btn.textContent = `Item ${i}`;
              btn.style.minWidth = '80px';
              w.node.appendChild(btn);
              return w;
            },
            position: 30 + i
          });
        }
      });
    });

    const chatPath = PathExt.join(tmpPath, CHAT);
    await createChat(page, CHAT, false, tmpPath);
    const chatSidePanel = await openChatToSide(page, chatPath);

    const reactiveToolbar = chatSidePanel.locator(
      '.jp-chat-input-container .jp-chat-input-reactive-toolbar'
    );
    await expect(reactiveToolbar).toBeVisible();

    // Narrow the side panel so items overflow into the popup.
    await page.evaluate(() => {
      const panel = document.querySelector(
        '.jp-chat-sidepanel'
      ) as HTMLElement | null;
      if (panel) {
        panel.style.width = '150px';
      }
    });

    // The popup opener button (>>) should become visible once items overflow.
    const popupOpener = reactiveToolbar.locator(
      '.jp-Toolbar-responsive-opener'
    );
    await expect(popupOpener).toBeVisible();

    // Open the popup and verify overflowed items are shown inside it.
    await popupOpener.locator('button').click();
    const popup = page.locator('.jp-chat-input-reactive-toolbar-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.jp-chat-test-overflow-item')).not.toHaveCount(
      0
    );
  });
});
