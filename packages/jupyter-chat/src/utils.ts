/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { CodeEditor } from '@jupyterlab/codeeditor';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor } from '@jupyterlab/fileeditor';
import { Notebook } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';

import { IUser } from './types';

const MENTION_CLASS = 'jp-chat-mention';

/**
 * Gets the editor instance used by a document widget. Returns `null` if unable.
 */
export function getEditor(
  widget: Widget | null
): CodeMirrorEditor | null | undefined {
  if (!(widget instanceof DocumentWidget)) {
    return null;
  }

  let editor: CodeEditor.IEditor | null | undefined;
  const { content } = widget;

  if (content instanceof FileEditor) {
    editor = content.editor;
  } else if (content instanceof Notebook) {
    editor = content.activeCell?.editor;
  }

  if (!(editor instanceof CodeMirrorEditor)) {
    return undefined;
  }

  return editor;
}

/**
 * Gets the index of the cell associated with `cellId`.
 */
export function getCellIndex(notebook: Notebook, cellId: string): number {
  const idx = notebook.model?.sharedModel.cells.findIndex(
    cell => cell.getId() === cellId
  );
  return idx === undefined ? -1 : idx;
}

/**
 * Replace a mention to user (@someone) to a span, for markdown renderer.
 *
 * @param content - the content to update.
 * @param user - the user mentioned.
 */
export function replaceMentionToSpan(content: string, user: IUser): string {
  if (!user.mention_name) {
    return content;
  }
  const mention = '@' + user.mention_name;
  const regex = new RegExp(mention, 'g');
  const mentionEl = `<span class="${MENTION_CLASS}">${mention}</span>`;
  return content.replace(regex, mentionEl);
}

/**
 * Replace a span to a mentioned to user string (@someone).
 *
 * @param content - the content to update.
 * @param user - the user mentioned.
 */
export function replaceSpanToMention(content: string, user: IUser): string {
  if (!user.mention_name) {
    return content;
  }
  const mention = '@' + user.mention_name;
  const mentionEl = `<span class="${MENTION_CLASS}">${mention}</span>`;
  const regex = new RegExp(mentionEl, 'g');
  return content.replace(regex, mention);
}
