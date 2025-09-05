/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PathExt } from '@jupyterlab/coreutils';

import { chatFileType } from './token';

/**
 *
 * @param defaultDirectory - the default directory.
 * @param path - the path of the chat file.
 * @returns - the display name of the chat.
 */
export function getDisplayName(
  path: string,
  defaultDirectory?: string
): string {
  const inDefault = defaultDirectory
    ? !PathExt.relative(defaultDirectory, path).startsWith('..')
    : true;

  const pattern = new RegExp(`${chatFileType.extensions[0]}$`, 'g');
  return (
    inDefault
      ? defaultDirectory
        ? PathExt.relative(defaultDirectory, path)
        : path
      : '/' + path
  ).replace(pattern, '');
}
