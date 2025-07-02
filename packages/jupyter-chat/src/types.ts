/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The user description.
 */
export interface IUser {
  username: string;
  name?: string;
  display_name?: string;
  initials?: string;
  color?: string;
  avatar_url?: string;
  /**
   * The string to use to mention a user in the chat. This should be computed
   * via the following procedure:
   *
   * 1. Let `mention_name = user.display_name || user.name || user.username`.
   *
   * 2. Replace each ' ' character with '-' in `mention_name`.
   */
  mention_name?: string;
  /**
   * Boolean identifying if user is a bot.
   */
  bot?: boolean;
}

/**
 * The configuration interface.
 */
export interface IConfig {
  /**
   * Whether to send a message via Shift-Enter instead of Enter.
   */
  sendWithShiftEnter?: boolean;
  /**
   * Whether to stack consecutive messages from same user.
   */
  stackMessages?: boolean;
  /**
   * Whether to enable or not the notifications on unread messages.
   */
  unreadNotifications?: boolean;
  /**
   * Whether to enable or not the code toolbar.
   */
  enableCodeToolbar?: boolean;
  /**
   * Whether to send typing notification.
   */
  sendTypingNotification?: boolean;
}

/**
 * The chat message description.
 */
export interface IChatMessage<T = IUser, U = IAttachment> {
  type: 'msg';
  body: string;
  id: string;
  time: number;
  sender: T;
  attachments?: U[];
  mentions?: T[];
  raw_time?: boolean;
  deleted?: boolean;
  edited?: boolean;
  stacked?: boolean;
}

/**
 * The chat history interface.
 */
export interface IChatHistory {
  messages: IChatMessage[];
}

/**
 * The content of a new message.
 */
export interface INewMessage {
  body: string;
  id?: string;
}

/**
 * The attachment type. Jupyter Chat allows for two types of attachments
 * currently:
 *
 * 1. File attachments (`IFileAttachment`)
 * 2. Notebook attachments (`INotebookAttachment`)
 *
 * The `type` field is always defined on every attachment, so it can be used to
 * distinguish different attachment types.
 */
export type IAttachment = IFileAttachment | INotebookAttachment;

export interface IFileAttachment {
  type: 'file';
  /**
   * The path to the file, relative to `ContentsManager.root_dir`.
   */
  value: string;
  /**
   * (optional) The MIME type of the attachment.
   */
  mimetype?: string;
  /**
   * (optional) A selection range within the file. See `IAttachmentSelection`
   * for more info.
   */
  selection?: IAttachmentSelection;
}

/**
 * Model of a single cell within a notebook attachment.
 *
 * The corresponding backend model is `NotebookCell`.
 */
export interface INotebookAttachmentCell {
  /**
   * The ID of the cell within the notebook.
   */
  id: string;
  /**
   * The type of the cell.
   */
  input_type: 'raw' | 'markdown' | 'code';
  /**
   * (optional) A selection range within the cell. See `IAttachmentSelection` for
   * more info.
   */
  selection?: IAttachmentSelection;
}

/**
 * Model of a notebook attachment.
 *
 * The corresponding backend model is `NotebookAttachment`.
 */
export interface INotebookAttachment {
  type: 'notebook';
  /**
   * The local path of the notebook, relative to `ContentsManager.root_dir`.
   */
  value: string;
  /**
   * (optional) A list of cells in the notebook.
   */
  cells?: INotebookAttachmentCell[];
}

export interface IAttachmentSelection {
  /**
   * The line number & column number of where the selection begins (inclusive).
   */
  start: [number, number];
  /**
   * The line number & column number of where the selection ends (inclusive).
   */
  end: [number, number];
  /**
   * The initial content of the selection.
   */
  content: string;
}

/**
 * An empty interface to describe optional settings that could be fetched from server.
 */
export interface ISettings {} /* eslint-disable-line @typescript-eslint/no-empty-object-type */
