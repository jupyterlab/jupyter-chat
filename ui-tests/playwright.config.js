/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

module.exports = {
  ...baseConfig,
  projects: [
    {
      name: 'jupyterlab',
      webServer: {
        command: 'jlpm start',
        url: 'http://localhost:8888/lab',
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI
      },
      testIgnore: 'tests/notebook-application.spec.ts'
    },
    {
      name: 'notebook',
      webServer: {
        command: 'jlpm start:notebook',
        url: 'http://localhost:8888/tree',
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI
      },
      testMatch: 'tests/notebook-application.spec.ts'
    }
  ],
  use: {
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write']
    }
  }
};
