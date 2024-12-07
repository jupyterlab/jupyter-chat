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
  webServer: {
    command: 'jlpm start:notebook',
    url: 'http://localhost:8888/tree',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  },
  testMatch: 'tests/notebook-application.spec.ts'
};
