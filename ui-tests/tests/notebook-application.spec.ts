import { expect, test as base } from '@jupyterlab/galata';

export const test = base.extend({
  waitForApplication: async ({ baseURL }, use, testInfo) => {
    const waitIsReady = async (page): Promise<void> => {
      await page.waitForSelector('#main-panel');
    };
    await use(waitIsReady);
  },
});

test.use({
  autoGoto: false,
  appPath: '',
  viewport: { width: 1024, height: 900 },
});

const NAME = 'my_chat';
const FILENAME = `${NAME}.chat`;

test.describe('#NotebookApp', () => {
  test.beforeEach(async ({ page }) => {
    // Create a chat file
    await page.filebrowser.contents.uploadContent('{}', 'text', FILENAME);
  });

  test.afterEach(async ({ page }) => {
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('Should open side panel and list existing chats', async ({ page }) => {
    await page.goto('tree');
    await page.menu.clickMenuItem('View>Left Sidebar>Show Jupyter Chat');
    const panel = page.locator('#jp-left-stack');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.jp-lab-chat-sidepanel')).toBeVisible();

    const select = panel.locator(
      '.jp-SidePanel-toolbar .jp-Toolbar-item.jp-lab-chat-open select'
    );

    await expect(select.locator('option')).toHaveCount(2);
    await expect(select.locator('option').last()).toHaveText(NAME);
  });

  test('Should open main panel in a separate tab', async ({ page, context }) => {
    await page.goto('tree');

    const pagePromise = context.waitForEvent('page');
    await page.dblclick(`.jp-FileBrowser-listing >> text=${FILENAME}`);

    const newPage = await pagePromise;
    //wait for Load
    // await newPage.waitForLoadState();

    await expect(newPage.locator('.jp-MainAreaWidget')).toHaveClass(/jp-lab-chat-main-panel/);
  });
});
