/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

// Reference snapshots render slightly differently across JupyterLab versions,
// so we only maintain a single snapshot set for the latest JupyterLab line.
// The CI matrix (see .github/workflows/ui-tests.yml) still exercises older
// JupyterLab versions for functional regressions, but sets JLAB_IGNORE_SNAPSHOTS
// there so screenshot comparisons are skipped instead of requiring a second,
// version-specific set of reference images.
const ignoreSnapshots = !!process.env.JLAB_IGNORE_SNAPSHOTS;

module.exports = {
  ...baseConfig,
  ignoreSnapshots,
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
