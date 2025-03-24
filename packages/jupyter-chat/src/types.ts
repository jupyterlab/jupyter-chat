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
 * The attachment interface.
 */
export interface IAttachment {
  /**
   * The type of the attachment (basically 'file', 'variable', 'image')
   */
  type: string;
  /**
   * The value, i.e. the file path, the variable name or image content.
   */
  value: string;
  /**
   * The mimetype of the attachment, optional.
   */
  mimetype?: string;
}

/**
 * An empty interface to describe optional settings that could be fetched from server.
 */
export interface ISettings {} /* eslint-disable-line @typescript-eslint/no-empty-object-type */
