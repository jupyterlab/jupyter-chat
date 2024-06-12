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
   * Last read message (no use yet).
   */
  lastRead?: number;
  /**
   * Whether to stack consecutive messages from same user.
   */
  stackMessages?: boolean;
  /**
   * Whether to enable or not the notifications on unread messages.
   */
  unreadNotifications?: boolean;
}

/**
 * The chat message description.
 */
export interface IChatMessage<T = IUser> {
  type: 'msg';
  body: string;
  id: string;
  time: number;
  sender: T;
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
 * An empty interface to describe optional settings that could be fetched from server.
 */
export interface ISettings {}

/**
 * The autocomplete command type.
 */
export type AutocompleteCommand = {
  label: string;
};

/**
 * The properties of the autocompletion.
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
   * - some arguments should not be provided and would be overwritten:
   *   - inputValue
   *   - onInputChange
   *   - onHighlightChange
   */
  props?: any;
}
