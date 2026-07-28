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

/*
 * `structuredClone` is a standard global in the browser (and Node), but the
 * jsdom test environment doesn't expose it. Provide it so code that relies on
 * it (e.g. input-model metadata, message cloning) can be unit-tested.
 */
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = value => JSON.parse(JSON.stringify(value));
}
