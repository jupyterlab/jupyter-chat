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

/**
 * The autocomplete command type.
 */
export type AutocompleteCommand = {
  label: string;
};

/**
 * Representation of a selected text.
 */
export type TextSelection = {
  type: 'text';
  source: string;
};

/**
 * Representation of a selected cell.
 */
export type CellSelection = {
  type: 'cell';
  source: string;
};

/**
 * Selection object (text or cell).
 */
export type Selection = TextSelection | CellSelection;

/**
 * The properties of the autocompletion.
 *
 * The autocompletion component will open if the 'opener' string is typed at the
 * beginning of the input field.
 */
export interface IAutocompletionCommandsProps {
  /**
   * The string that open the completer.
   */
  opener: string;
  /**
   * The list of available commands.
   */
  commands?: AutocompleteCommand[] | (() => Promise<AutocompleteCommand[]>);
  /**
   * The props for the Autocomplete component.
   *
   * Must be compatible with https://mui.com/material-ui/api/autocomplete/#props.
   *
   * ## NOTES:
   * - providing `options` will overwrite the commands argument.
   * - providing `renderInput` will overwrite the input component.
   * - providing `renderOptions` allows to customize the rendering of the component.
   * - some arguments should not be provided and would be overwritten:
   *   - inputValue
   *   - onInputChange
   *   - onHighlightChange
   */
  props?: any;
}
