/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

// Snapshot references are rendered slightly differently across JupyterLab
// versions, so when the UI tests run against multiple versions (see the CI
// matrix in .github/workflows/ui-tests.yml) each version must keep its own
// reference snapshots. Setting JLAB_SNAPSHOT_SUBDIR inserts a per-version
// subfolder into the snapshot path. When it is unset (e.g. local runs), the
// template collapses to Playwright's default layout, so existing behaviour is
// unchanged.
const snapshotSubdir = process.env.JLAB_SNAPSHOT_SUBDIR || '';

module.exports = {
  ...baseConfig,
  snapshotPathTemplate: [
    '{testFileDir}/{testFileName}-snapshots',
    snapshotSubdir,
    '{arg}{-projectName}{-snapshotSuffix}{ext}'
  ]
    .filter(Boolean)
    .join('/'),
  webServer: {
    command: 'jlpm start',
    url: 'http://localhost:8888/lab',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  },
  testIgnore: 'tests/notebook-application.spec.ts',
  use: {
    ...baseConfig.use,
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write']
    }
  }
};
