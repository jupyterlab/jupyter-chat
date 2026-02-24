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

import { IMessage, IUser } from './types';

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

/**
 * Trigger a browser download of a Markdown-formatted chat export.
 *
 * @param chatName - Raw model name (e.g. "path/to/my.chat"). Used to derive the
 *   filename and as the document title passed to formatChatAsMarkdown.
 * @param messages - Messages to export.
 */
export function downloadChatAsMarkdown(
  chatName: string,
  messages: ReadonlyArray<IMessage>
): void {
  // Use || (not ??) so that empty string '' also falls back to 'chat'.
  const name = chatName || 'chat';
  const basename = name.split('/').pop()?.replace(/\.chat$/, '') || name;
  const markdown = formatChatAsMarkdown(basename, messages);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${basename}.md`;
  a.style.display = 'none';
  document.body.appendChild(a); // Firefox requires DOM attachment
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100); // delayed to avoid premature revoke
}

/**
 * Format chat messages as a Markdown document for export.
 *
 * @param chatName - The display name of the chat, used as the document title.
 * @param messages - Messages to format. Deleted messages are skipped.
 * @returns A Markdown-formatted string ready for download.
 */
export function formatChatAsMarkdown(
  chatName: string,
  messages: ReadonlyArray<IMessage>
): string {
  const lines: string[] = [`# ${chatName}`, ''];
  const visibleMessages = messages.filter(msg => !msg.deleted);
  if (visibleMessages.length === 0) {
    lines.push('*(No messages)*', '');
    return lines.join('\n');
  }
  for (const msg of visibleMessages) {
    const displayName = msg.sender.display_name || msg.sender.username || 'Unknown';
    const timestamp = new Date(msg.time * 1000).toLocaleString();
    const body = typeof msg.body === 'string' ? msg.body : '[Rich content]';
    lines.push(`**${displayName}** — ${timestamp}`, '', body, '', '---', '');
  }
  return lines.join('\n');
}
