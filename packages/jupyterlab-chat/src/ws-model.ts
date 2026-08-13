/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  AbstractChatContext,
  AbstractChatModel,
  IChatContext,
  IChatModel,
  IMessageContent,
  INewMessage,
  IUser
} from '@jupyter/chat';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection, User } from '@jupyterlab/services';
import { UUID } from '@lumino/coreutils';

import { IWidgetConfig } from './token';

const WS_PATH = 'api/jupyter-chat/ws';

export namespace WsChatModel {
  export interface IOptions extends IChatModel.IOptions {
    path: string;
    user: User.IIdentity | null;
    widgetConfig: IWidgetConfig;
    serverSettings?: ServerConnection.ISettings;
  }
}

/**
 * A chat model backed by a plain WebSocket connection, used when
 * jupyter-collaboration is not installed.
 *
 * One instance is created per .chat file opened in the side panel.
 * The server maintains one room per file path and broadcasts messages
 * to all connected clients.
 */
export class WsChatModel extends AbstractChatModel {
  constructor(options: WsChatModel.IOptions) {
    super(options);

    this._path = options.path;
    this._serverSettings =
      options.serverSettings ?? ServerConnection.makeSettings();

    const identity = options.user;
    this._currentUser = identity
      ? {
          username: identity.username,
          name: identity.name,
          display_name: identity.display_name,
          initials: identity.initials,
          color: identity.color ?? undefined,
          avatar_url: identity.avatar_url ?? undefined
        }
      : { username: 'anonymous' };

    this.config = options.widgetConfig.config;
    options.widgetConfig.configChanged.connect((_, config) => {
      this.config = config;
    });
  }

  readonly collaborative = false;

  get user(): IUser {
    return this._currentUser;
  }

  /**
   * All users known to this model (populated from the connection message).
   * Exposed for use by WsChatContext.
   */
  get knownUsers(): IUser[] {
    return Object.values(this._usersMap);
  }

  /**
   * Open the WebSocket connection and wait until the server sends the
   * connection message (which also carries the full message history).
   */
  async initialize(): Promise<void> {
    this._openSocket();
    return this.ready;
  }

  sendMessage(message: INewMessage): string | null {
    if (!message.body && !message.mime_model && !message.attachments?.length) {
      return null;
    }

    const id = UUID.uuid4();
    const msg: Record<string, unknown> = {
      type: 'msg',
      id,
      body: message.body ?? ''
    };

    if (message.mime_model) {
      msg.mime_model = message.mime_model;
    }
    if (message.attachments?.length) {
      msg.attachments = message.attachments;
    }
    if (message.mentions?.length) {
      msg.mentions = message.mentions.map(u => u.username);
    }
    if (message.metadata) {
      msg.metadata = message.metadata;
    }

    this._socket?.send(JSON.stringify(msg));
    return id;
  }

  updateMessage(id: string, updatedMessage: IMessageContent): void {
    const msg: Record<string, unknown> = {
      type: 'msg',
      is_update: true,
      id,
      body: updatedMessage.body,
      edited: true
    };
    if (updatedMessage.attachments?.length) {
      msg.attachments = updatedMessage.attachments;
    }
    if (updatedMessage.mentions?.length) {
      msg.mentions = updatedMessage.mentions.map(u => u.username);
    }
    this._socket?.send(JSON.stringify(msg));
  }

  deleteMessage(id: string): void {
    this._socket?.send(
      JSON.stringify({
        type: 'msg',
        is_update: true,
        id,
        body: '',
        deleted: true
      })
    );
  }

  createChatContext(): IChatContext {
    return new WsChatContext({ model: this });
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._socket?.close();
    this._socket = null;
    super.dispose();
  }

  private _openSocket(): void {
    const wsUrl = URLExt.join(this._serverSettings.wsUrl, WS_PATH);
    const token = this._serverSettings.token;
    const url =
      `${wsUrl}?path=${encodeURIComponent(this._path)}` +
      (token ? `&token=${encodeURIComponent(token)}` : '');

    this._socket = new WebSocket(url);
    this._socket.onmessage = event => this._onMessage(event);
    this._socket.onclose = event => this._onClose(event);
    this._socket.onerror = error =>
      console.error('WS chat connection error:', error);
  }

  private _onMessage(event: MessageEvent): void {
    let data: any;
    try {
      data = JSON.parse(event.data as string);
    } catch (e) {
      console.error('WS chat: invalid JSON received', e);
      return;
    }

    if (data.type === 'connection') {
      this._usersMap = (data.users as Record<string, IUser>) ?? {};

      // Load the full message history sent on connection.
      for (const msg of (data.messages as any[]) ?? []) {
        this.messageAdded(this._toMessageContent(msg));
      }
      this.setReady();
    } else if (data.type === 'users') {
      // A new client joined — merge the updated users map.
      this._usersMap = {
        ...this._usersMap,
        ...(data.users as Record<string, IUser>)
      };
    } else if (data.type === 'msg' && data.message) {
      // Both new messages and updates go through messageAdded — the base
      // class already handles updates by id (removes + re-inserts).
      this.messageAdded(this._toMessageContent(data.message));
    }
  }

  private _onClose(event: CloseEvent): void {
    if (event.code === 1006 && !this.isDisposed) {
      // Abnormal close — reconnect after a short delay.
      setTimeout(() => {
        if (!this.isDisposed) {
          this._openSocket();
        }
      }, 1000);
    }
  }

  private _toMessageContent(msg: any): IMessageContent {
    const username = msg.sender as string;
    const sender: IUser = this._usersMap[username] ?? {
      username,
      name: username,
      display_name: username
    };

    const content: IMessageContent = { ...msg, sender };

    // Convert mention username strings back to IUser objects.
    if (Array.isArray(msg.mentions)) {
      content.mentions = (msg.mentions as string[]).map(
        u => this._usersMap[u] ?? { username: u, name: u, display_name: u }
      );
    }

    return content;
  }

  private _path: string;
  private _currentUser: IUser;
  private _usersMap: Record<string, IUser> = {};
  private _socket: WebSocket | null = null;
  private _serverSettings: ServerConnection.ISettings;
}

class WsChatContext extends AbstractChatContext {
  get users(): IUser[] {
    return (this._model as WsChatModel).knownUsers;
  }
}
