/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatModel } from '@jupyter/chat';
import { PathExt } from '@jupyterlab/coreutils';

import { chatFileType, ILabChatModel } from './token';

/**
 * Return the path of the chat file of a model.
 *
 * Useful when the model is only known as a generic chat model (e.g. from the
 * chat tracker).
 *
 * @param model - the chat model.
 * @returns - the path of the chat file, or undefined if the model has no path
 *   (e.g. a chat model that is not a lab chat model).
 */
export function getChatPath(model: IChatModel): string | undefined {
  return (model as ILabChatModel).path;
}

/**
 * Return the name of the chat from its path.
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

/**
 * Resolve the target path for a chat rename.
 *
 * When the new name is a bare basename (the usual case when renaming via the
 * dialog), the chat must stay in the same directory as the original file.
 * Otherwise `Contents.rename` treats the name as root-relative and moves the
 * chat out of its directory (e.g. the configured `defaultDirectory`).
 *
 * @param oldPath - the current path of the chat file (e.g. `chats/untitled.chat`).
 * @param newName - the new name or path entered by the user (e.g. `test`).
 * @returns - the resolved path, with the `.chat` extension ensured and the
 *   original directory preserved when `newName` has no directory component.
 */
export function resolveChatRenamePath(
  oldPath: string,
  newName: string
): string {
  let newPath = newName;

  // Ensure the `.chat` extension.
  if (!newPath.endsWith(chatFileType.extensions[0])) {
    newPath = `${newPath}${chatFileType.extensions[0]}`;
  }

  // Bare basename (no separator) -> keep it in the original file's directory.
  // An explicit directory in `newName` is respected as-is.
  if (!newPath.includes('/')) {
    newPath = PathExt.join(PathExt.dirname(oldPath), newPath);
  }

  return newPath;
}
