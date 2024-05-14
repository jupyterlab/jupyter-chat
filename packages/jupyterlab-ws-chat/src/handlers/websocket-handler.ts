/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatModel,
  IChatHistory,
  IChatMessage,
  INewMessage,
  IUser
} from '@jupyter/chat';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { PromiseDelegate, UUID } from '@lumino/coreutils';

import { requestAPI } from './handler';

const CHAT_SERVICE_URL = 'api/chat';

/**
 * The interface for a user with ID.
 */
export interface IWsUser extends IUser {
  /**
   * The id of the user. A unique client ID assigned to identify different JupyterLab
   * clients on the same device (i.e. running on multiple tabs/windows), which may
   * have the same username assigned to them by the IdentityProvider.
   */
  id?: string;
}

/**
 * The interface for a chat message, which includes an ID to the sender.
 */
export interface IWsMessage extends IChatMessage {
  /**
   * The id of the message sender.
   */
  sender: IWsUser | string;
}

export type ConnectionMessage = {
  type: 'connection';
  client_id: string;
};

type GenericMessage = IWsMessage | ConnectionMessage;

/**
 * An implementation of the chat model based on websocket handler.
 */
export class WebSocketHandler extends ChatModel {
  /**
   * The server settings used to make API requests.
   */
  readonly serverSettings: ServerConnection.ISettings;

  /**
   * Create a new chat handler.
   */
  constructor(options: WebSocketHandler.IOptions = {}) {
    super(options);
    this.serverSettings =
      options.serverSettings ?? ServerConnection.makeSettings();
  }

  /**
   * Initializes the WebSocket connection to the Chat backend. Promise is
   * resolved when server acknowledges connection and sends the client ID. This
   * must be awaited before calling any other method.
   */
  async initialize(): Promise<void> {
    this._initialize();
    await this._connectionInitialized.promise;
  }

  /**
   * Sends a message across the WebSocket. Promise resolves to the message ID
   * when the server sends the same message back, acknowledging receipt.
   */
  addMessage(message: INewMessage): Promise<boolean> {
    message.id = UUID.uuid4();
    return new Promise(resolve => {
      this._socket?.send(JSON.stringify(message));
      this._sendResolverQueue.set(message.id!, resolve);
    });
  }

  async getHistory(): Promise<IChatHistory> {
    let data: IChatHistory = { messages: [] };
    try {
      data = await requestAPI('history', {
        method: 'GET'
      });
    } catch (e) {
      return Promise.reject(e);
    }
    return data;
  }

  /**
   * Dispose the chat handler.
   */
  dispose(): void {
    super.dispose();

    // Clean up socket.
    const socket = this._socket;
    if (socket) {
      this._socket = null;
      socket.onopen = () => undefined;
      socket.onerror = () => undefined;
      socket.onmessage = () => undefined;
      socket.onclose = () => undefined;
      socket.close();
    }
  }

  onMessage(message: GenericMessage): void {
    // resolve promise from `sendMessage()`
    if (message.type === 'msg') {
      const sender =
        typeof message.sender !== 'string' ? message.sender.id : message.sender;

      if (sender === this.id) {
        this._sendResolverQueue.get(message.id)?.(true);
      }
      super.onMessage(message);
    } else if (message.type === 'connection') {
      this.id = message.client_id;
      this._connectionInitialized.resolve(true);
    }
  }

  private _onClose(e: CloseEvent) {
    this._connectionInitialized.reject(
      new Error('Chat UI websocket disconnected')
    );
    console.error('Chat UI websocket disconnected');
    // only attempt re-connect if there was an abnormal closure
    // WebSocket status codes defined in RFC 6455: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
    if (e.code === 1006) {
      const delaySeconds = 1;
      console.info(`Will try to reconnect in ${delaySeconds} s.`);
      setTimeout(async () => await this.initialize(), delaySeconds * 1000);
    }
  }

  private _initialize(): void {
    if (this.isDisposed) {
      return;
    }
    console.log('Creating a new websocket connection for chat...');
    const { token, WebSocket, wsUrl } = this.serverSettings;
    const url =
      URLExt.join(wsUrl, CHAT_SERVICE_URL) +
      (token ? `?token=${encodeURIComponent(token)}` : '');

    const socket = (this._socket = new WebSocket(url));
    socket.onclose = e => this._onClose(e);
    socket.onerror = e => console.error(e);
    socket.onmessage = msg => msg.data && this.onMessage(JSON.parse(msg.data));
  }

  /**
   * The websocket.
   */
  private _socket: WebSocket | null = null;
  /**
   * Queue of Promise resolvers pushed onto by `send()`.
   */
  private _sendResolverQueue = new Map<string, (value: boolean) => void>();
  /**
   * A promise that resolves when the connection is initialized.
   */
  private _connectionInitialized = new PromiseDelegate<boolean>();
}

/**
 * The websocket namespace.
 */
export namespace WebSocketHandler {
  /**
   * The instantiation options for a data registry handler.
   */
  export interface IOptions extends ChatModel.IOptions {
    serverSettings?: ServerConnection.ISettings;
  }
}
