/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/*
 * Mock IntersectionObserver used by @jupyterlab/notebook for windowing.
 * We use a simple mock here instead of @jupyterlab/testutils/lib/jest-shim
 * to avoid extra dependencies. This lightweight mock is sufficient for our tests.
 */
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
