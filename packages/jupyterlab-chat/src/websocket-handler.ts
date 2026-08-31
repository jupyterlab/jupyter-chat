/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IMessageContent, INewMessage, IUser } from '@jupyter/chat';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { PromiseDelegate, UUID } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { ILabChatModel } from './token';
import {
  CLIENT,
  IClientChatWsMessage,
  IClientEditMessage,
  IClientSendMessage,
  IServerChatWsMessage,
  IWireMessage,
  SERVER
} from './ws-messages';

const WS_PATH = 'api/chat/ws';

export namespace WebSocketHandler {
  export interface IOptions {
    serverSettings: ServerConnection.ISettings;
    model: ILabChatModel;
  }

  /**
   * A writing status pushed by the server (e.g. an AI agent). In RTC-free mode
   * clients never advertise their own typing, so writers only originate
   * server-side.
   */
  export interface IWriting {
    /** The user the status is about. */
    user: IUser;
    /** True if the user is writing, false if they stopped. */
    state: boolean;
    /** The message being edited, if any. */
    messageID?: string;
    /** Optional custom typing-indicator text. */
    typingIndicator?: string;
  }
}

/**
 * Owns the WebSocket connection for a single chat file.
 *
 * Responsibilities:
 * - Open and maintain the WS connection (reconnect on abnormal close)
 * - Own the WS protocol: parse raw frames, maintain the users map, resolve
 *   sender/mention usernames to IUser objects
 * - Emit clean IMessageContent objects via `messageReceived` for every
 *   message — both historical (on connection) and live
 * - Expose a `ready` promise that resolves once the initial connection
 *   message has been processed
 * - Provide typed send methods (sendMessage / updateMessage / deleteMessage)
 *
 * The path is not known at construction time (LabChatModel learns it from the
 * document context), so it must be set via `setPath()` before `initialize()`.
 */
export class WebSocketHandler {
  constructor(options: WebSocketHandler.IOptions) {
    this._serverSettings = options.serverSettings;
    this._model = options.model;
  }

  /**
   * Emitted for every message received from the server — including the
   * historical messages delivered on connection — as a resolved IMessageContent.
   */
  get messageReceived(): ISignal<this, IMessageContent> {
    return this._messageReceived;
  }

  /**
   * Emitted whenever the set of known users changes — on the initial
   * connection message and on every subsequent 'users' update.
   * The payload is the map of new/updated users received from the server.
   */
  get usersChanged(): ISignal<this, Record<string, IUser>> {
    return this._usersChanged;
  }

  /**
   * Emitted whenever chat metadata changes -- on every 'metadata' update pushed
   * by the server. The payload is the map of new/updated metadata entries.
   */
  get metadataChanged(): ISignal<this, Record<string, any>> {
    return this._metadataChanged;
  }

  /**
   * Emitted whenever a writing status is pushed by the server (e.g. an AI agent).
   */
  get writingChanged(): ISignal<this, WebSocketHandler.IWriting> {
    return this._writingChanged;
  }

  /**
   * Resolves once the server has sent its initial connection message
   * (which carries the full message history).
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * The server-assigned chat id, received on the connection message. Available
   * once `ready` has resolved; `undefined` against older servers that do not
   * send it.
   */
  get chatId(): string | undefined {
    return this._chatId;
  }

  /**
   * The identity the server registered for this connection, received on the
   * connection message. Available once `ready` has resolved; `undefined`
   * against older servers that do not send it.
   */
  get connectedUser(): IUser | undefined {
    return this._connectedUser;
  }

  setPath(path: string): void {
    this._path = path;
  }

  initialize(): void {
    this._openSocket();
  }

  sendMessage(message: INewMessage): string {
    const id = UUID.uuid4();
    const msg: IClientSendMessage = {
      type: CLIENT,
      action: 'send',
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
    this._send(msg);
    return id;
  }

  updateMessage(id: string, message: IMessageContent): void {
    const msg: IClientEditMessage = {
      type: CLIENT,
      action: 'edit',
      id,
      body: message.body,
      edited: true
    };
    if (message.attachments?.length) {
      msg.attachments = message.attachments;
    }
    if (message.mentions?.length) {
      msg.mentions = message.mentions.map(u => u.username);
    }
    this._send(msg);
  }

  deleteMessage(id: string): void {
    this._send({
      type: CLIENT,
      action: 'edit',
      id,
      body: '',
      deleted: true
    });
  }

  dispose(): void {
    this._disposed = true;
    this._socket?.close();
    this._socket = null;
    Signal.clearData(this);
  }

  private _handleMessage(data: IServerChatWsMessage): void {
    if (data.type !== SERVER) {
      return;
    }
    switch (data.action) {
      case 'connection': {
        this._chatId = data.id;
        this._connectedUser = data.user ?? undefined;
        this._usersMap = data.users ?? {};
        for (const user of Object.values(this._usersMap)) {
          if (!this._model.sharedModel.getUser(user.username)) {
            this._model.sharedModel.setUser(user);
          }
        }
        const messages = (data.messages ?? []).map(msg =>
          this._applyMessage(msg)
        );
        this._usersChanged.emit(this._usersMap);
        for (const content of messages) {
          this._messageReceived.emit(content);
        }
        this._connected = true;
        this._ready.resolve();
        break;
      }
      case 'users': {
        const incoming = data.users ?? {};
        this._usersMap = { ...this._usersMap, ...incoming };
        for (const user of Object.values(incoming)) {
          if (!this._model.sharedModel.getUser(user.username)) {
            this._model.sharedModel.setUser(user);
          }
        }
        this._usersChanged.emit(incoming);
        break;
      }
      case 'metadata': {
        const metadata = data.metadata ?? {};
        for (const [key, value] of Object.entries(metadata)) {
          this._model.sharedModel.setMetadata(key, value);
        }
        this._metadataChanged.emit(metadata);
        break;
      }
      case 'message': {
        const content = this._applyMessage(data.message);
        this._messageReceived.emit(content);
        break;
      }
      case 'writing': {
        const user: IUser = data.user ?? {
          username: '',
          name: '',
          display_name: ''
        };
        const writing: WebSocketHandler.IWriting = {
          user,
          state: !!data.state,
          messageID: data.messageID,
          typingIndicator: data.typingIndicator
        };
        if (user.username !== this._model.user?.username) {
          if (writing.state) {
            this._model.setWritingStatus(writing.user, {
              messageID: writing.messageID,
              typingIndicator: writing.typingIndicator
            });
          } else {
            this._model.clearWritingStatus(writing.user);
          }
        }
        this._writingChanged.emit(writing);
        break;
      }
    }
  }

  private _applyMessage(msg: IWireMessage): IMessageContent {
    const username = msg.sender;
    const sender: IUser = this._usersMap[username] ?? {
      username,
      name: username,
      display_name: username
    };
    const content: IMessageContent = {
      type: msg.type ?? 'msg',
      id: msg.id,
      body: msg.body ?? '',
      time: msg.time ?? Date.now() / 1000,
      sender
    };
    if (msg.raw_time !== undefined) {
      content.raw_time = msg.raw_time;
    }
    if (msg.edited !== undefined) {
      content.edited = msg.edited;
    }
    if (msg.deleted !== undefined) {
      content.deleted = msg.deleted;
    }
    if (msg.metadata !== undefined) {
      content.metadata = msg.metadata;
    }
    if (msg.mime_model !== undefined) {
      content.mime_model = msg.mime_model;
    }
    if (Array.isArray(msg.attachments) && msg.attachments.length) {
      content.attachments = msg.attachments;
    }
    if (Array.isArray(msg.mentions) && msg.mentions.length) {
      content.mentions = (msg.mentions as string[]).map(
        u => this._usersMap[u] ?? { username: u, name: u, display_name: u }
      );
    }
    const ymsg = this._model.toYMessage(content);
    const index = this._model.sharedModel.getMessageIndex(ymsg.id);
    if (index >= 0) {
      this._model.sharedModel.updateMessage(index, ymsg);
    } else {
      this._model.sharedModel.addMessage(ymsg);
    }
    return content;
  }

  private _send(data: IClientChatWsMessage): void {
    this._socket?.send(JSON.stringify(data));
  }

  private _openSocket(): void {
    const wsUrl = `${URLExt.join(this._serverSettings.wsUrl, WS_PATH)}/${encodeURIComponent(this._path)}`;
    const token = this._serverSettings.token;
    const url = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;

    this._socket = new WebSocket(url);
    this._socket.onmessage = event => {
      try {
        this._handleMessage(
          JSON.parse(event.data as string) as IServerChatWsMessage
        );
      } catch (e) {
        console.error('WS chat: invalid JSON received', e);
      }
    };
    this._socket.onclose = event => {
      if (this._disposed) {
        return;
      }
      // Closed before the connection frame arrived: signal failure so callers can
      // distinguish between an unreachable server (code 1006, e.g. JupyterLite) and
      // an explicit server-side rejection (any other code, e.g. 1008 for invalid path).
      if (!this._connected) {
        this._ready.reject(
          Object.assign(
            new Error(
              event.reason ||
                `Chat WebSocket was closed before opening (code ${event.code})`
            ),
            { wsCloseCode: event.code }
          )
        );
        return;
      }
      // An established connection dropped abnormally: try to reconnect.
      if (event.code === 1006) {
        setTimeout(() => {
          if (!this._disposed) {
            this._openSocket();
          }
        }, 1000);
      }
    };
    this._socket.onerror = error => {
      if (this._connected) {
        console.error('WS chat connection error:', error);
      }
    };
  }

  private _path = '';
  private _disposed = false;
  private _model: ILabChatModel;
  private _connected = false;
  private _chatId: string | undefined;
  private _connectedUser: IUser | undefined;
  private _socket: WebSocket | null = null;
  private _serverSettings: ServerConnection.ISettings;
  private _usersMap: Record<string, IUser> = {};
  private _ready = new PromiseDelegate<void>();
  private _messageReceived = new Signal<this, IMessageContent>(this);
  private _usersChanged = new Signal<this, Record<string, IUser>>(this);
  private _metadataChanged = new Signal<this, Record<string, any>>(this);
  private _writingChanged = new Signal<this, WebSocketHandler.IWriting>(this);
}
