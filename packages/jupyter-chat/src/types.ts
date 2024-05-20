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
  sendWithShiftEnter?: boolean;
  lastRead?: number;
  stackMessages?: boolean;
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
