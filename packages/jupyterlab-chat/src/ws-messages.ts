/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IUser } from '@jupyter/chat';

/**
 * Typed schema for the per-chat `/api/chat/ws` WebSocket protocol.
 *
 * Every frame is discriminated by two fields:
 * - `type`: the *direction* -- `'client'` (web client -> server) or `'server'`
 *   (server -> web client).
 * - `action`: the specific message within a direction.
 *
 * ```
 * ChatWsMessage       = ClientChatWsMessage | ServerChatWsMessage
 * ClientChatWsMessage = IClientSendMessage | IClientEditMessage
 * ServerChatWsMessage = IServerConnectionMessage | IServerMessageMessage
 *                     | IServerUsersMessage | IServerMetadataMessage
 *                     | IServerWritingMessage
 * ```
 *
 * This mirrors the backend definition in
 * `python/jupyterlab-chat/jupyterlab_chat/ws_messages.py`; the two must stay in
 * sync.
 */

/** Direction discriminator values (the `type` field). */
export const CLIENT = 'client';
export const SERVER = 'server';

/** A raw message object as it travels on the wire (pre-resolution). */
export interface IWireMessage {
  id: string;
  sender: string;
  body?: string;
  time?: number;
  type?: string;
  raw_time?: boolean;
  edited?: boolean;
  deleted?: boolean;
  metadata?: Record<string, any>;
  mime_model?: any;
  attachments?: any[];
  mentions?: string[];
}

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------
export interface IClientSendMessage {
  type: typeof CLIENT;
  action: 'send';
  id: string;
  body: string;
  mentions?: string[];
  metadata?: Record<string, any>;
  attachments?: any[];
  mime_model?: any;
}

export interface IClientEditMessage {
  type: typeof CLIENT;
  action: 'edit';
  id: string;
  body?: string;
  deleted?: boolean;
  edited?: boolean;
  mentions?: string[];
  metadata?: Record<string, any>;
  attachments?: any[];
}

export type IClientChatWsMessage = IClientSendMessage | IClientEditMessage;

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------
export interface IServerConnectionMessage {
  type: typeof SERVER;
  action: 'connection';
  client_id: string;
  id: string;
  user: IUser;
  messages: IWireMessage[];
  users: Record<string, IUser>;
}

export interface IServerMessageMessage {
  type: typeof SERVER;
  action: 'message';
  message: IWireMessage;
}

export interface IServerUsersMessage {
  type: typeof SERVER;
  action: 'users';
  users: Record<string, IUser>;
}

export interface IServerMetadataMessage {
  type: typeof SERVER;
  action: 'metadata';
  metadata: Record<string, any>;
}

export interface IServerWritingMessage {
  type: typeof SERVER;
  action: 'writing';
  user: IUser;
  state: boolean;
  messageID?: string;
  typingIndicator?: string;
}

export type IServerChatWsMessage =
  | IServerConnectionMessage
  | IServerMessageMessage
  | IServerUsersMessage
  | IServerMetadataMessage
  | IServerWritingMessage;

export type IChatWsMessage = IClientChatWsMessage | IServerChatWsMessage;
