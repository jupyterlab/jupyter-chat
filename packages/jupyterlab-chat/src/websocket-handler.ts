/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IMessageContent, INewMessage, IUser } from '@jupyter/chat';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { PromiseDelegate, UUID } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

const WS_PATH = 'api/jupyter-chat/ws';

export namespace WebSocketHandler {
  export interface IOptions {
    serverSettings: ServerConnection.ISettings;
    /**
     * The local user identity. Carried on outgoing message frames so the
     * server records the sender as the client's identity (matching the
     * collaborative mode, where the sender is set on the frontend). Optional
     * for backward compatibility — the server falls back to its authenticated
     * user when absent.
     */
    user?: IUser;
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
    this._user = options.user ?? null;
  }

  /**
   * The local user identity, carried on outgoing message frames.
   */
  set user(value: IUser | null) {
    this._user = value;
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

  setPath(path: string): void {
    this._path = path;
  }

  initialize(): void {
    this._openSocket();
  }

  sendMessage(message: INewMessage): string {
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
    if (this._user) {
      msg.user = this._user;
    }
    this._send(msg);
    return id;
  }

  updateMessage(id: string, message: IMessageContent): void {
    const msg: Record<string, unknown> = {
      type: 'msg',
      is_update: true,
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
    this._send({ type: 'msg', is_update: true, id, body: '', deleted: true });
  }

  dispose(): void {
    this._disposed = true;
    this._socket?.close();
    this._socket = null;
    Signal.clearData(this);
  }

  private _handleMessage(data: any): void {
    if (data.type === 'connection') {
      this._usersMap = (data.users as Record<string, IUser>) ?? {};
      this._usersChanged.emit(this._usersMap);
      for (const msg of (data.messages as any[]) ?? []) {
        this._messageReceived.emit(this._toMessageContent(msg));
      }
      this._ready.resolve();
    } else if (data.type === 'users') {
      const incoming = (data.users as Record<string, IUser>) ?? {};
      this._usersMap = { ...this._usersMap, ...incoming };
      this._usersChanged.emit(incoming);
    } else if (data.type === 'msg' && data.message) {
      this._messageReceived.emit(this._toMessageContent(data.message));
    } else if (data.type === 'writing') {
      const user: IUser = data.user ?? {
        username: data.sender,
        name: data.sender,
        display_name: data.sender
      };
      this._writingChanged.emit({
        user,
        state: !!data.state,
        messageID: data.messageID,
        typingIndicator: data.typingIndicator
      });
    }
  }

  private _toMessageContent(msg: any): IMessageContent {
    const username = msg.sender as string;
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
    return content;
  }

  private _send(data: Record<string, unknown>): void {
    this._socket?.send(JSON.stringify(data));
  }

  private _openSocket(): void {
    const wsUrl = URLExt.join(this._serverSettings.wsUrl, WS_PATH);
    const token = this._serverSettings.token;
    const url =
      `${wsUrl}?path=${encodeURIComponent(this._path)}` +
      (token ? `&token=${encodeURIComponent(token)}` : '') +
      (this._user
        ? `&user=${encodeURIComponent(JSON.stringify(this._user))}`
        : '');

    this._socket = new WebSocket(url);
    this._socket.onmessage = event => {
      try {
        this._handleMessage(JSON.parse(event.data as string));
      } catch (e) {
        console.error('WS chat: invalid JSON received', e);
      }
    };
    this._socket.onclose = event => {
      if (event.code === 1006 && !this._disposed) {
        setTimeout(() => {
          if (!this._disposed) {
            this._openSocket();
          }
        }, 1000);
      }
    };
    this._socket.onerror = error =>
      console.error('WS chat connection error:', error);
  }

  private _path = '';
  private _disposed = false;
  private _user: IUser | null = null;
  private _socket: WebSocket | null = null;
  private _serverSettings: ServerConnection.ISettings;
  private _usersMap: Record<string, IUser> = {};
  private _ready = new PromiseDelegate<void>();
  private _messageReceived = new Signal<this, IMessageContent>(this);
  private _usersChanged = new Signal<this, Record<string, IUser>>(this);
  private _writingChanged = new Signal<this, WebSocketHandler.IWriting>(this);
}
