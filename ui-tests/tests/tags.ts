/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Shared Playwright tag for tests that only make sense with real-time
 * collaboration (RTC) enabled.
 *
 * The RTC-free CI job excludes them with `jlpm test --grep-invert @collaborative`;
 * the RTC jobs run everything. The tag string is centralised here so the CI
 * filter and the tests never drift apart.
 */
export const COLLABORATIVE_TAG = '@collaborative';

/**
 * Marks a `test` or `test.describe` block as collaborative-only.
 *
 * TypeScript method decorators cannot be applied to Playwright's `test()` /
 * `test.describe()` calls (they are function calls, not class methods), so the
 * declarative equivalent is to pass this as the options argument:
 *
 * ```ts
 * import { collaborativeOnly } from './tags';
 *
 * test.describe('#typingNotification', collaborativeOnly, () => { ... });
 * test('guest mention', collaborativeOnly, async ({ page }) => { ... });
 * ```
 *
 * The exclusion is then visible both in the source and in the Playwright report.
 */
export const collaborativeOnly = { tag: COLLABORATIVE_TAG };
