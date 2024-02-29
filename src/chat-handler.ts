import { URLExt } from '@jupyterlab/coreutils';
import { IDisposable } from '@lumino/disposable';
import { ServerConnection } from '@jupyterlab/services';

import { requestAPI } from './handler';
import { ChatService } from './services';

const CHAT_SERVICE_URL = 'api/chat';

export class ChatHandler implements IDisposable {
  /**
   * The server settings used to make API requests.
   */
  readonly serverSettings: ServerConnection.ISettings;

  /**
   * ID of the connection. Requires `await initialize()`.
   */
  id = '';

  /**
   * Create a new chat handler.
   */
  constructor(options: ChatHandler.IOptions = {}) {
    this.serverSettings =
      options.serverSettings ?? ServerConnection.makeSettings();
  }

  /**
   * Initializes the WebSocket connection to the Chat backend. Promise is
   * resolved when server acknowledges connection and sends the client ID. This
   * must be awaited before calling any other method.
   */
  public async initialize(): Promise<void> {
    await this._initialize();
  }

  /**
   * Sends a message across the WebSocket. Promise resolves to the message ID
   * when the server sends the same message back, acknowledging receipt.
   */
  public sendMessage(message: ChatService.ChatRequest): Promise<string> {
    return new Promise(resolve => {
      this._socket?.send(JSON.stringify(message));
      this._sendResolverQueue.push(resolve);
    });
  }

  public addListener(handler: (message: ChatService.IMessage) => void): void {
    this._listeners.push(handler);
  }

  public removeListener(
    handler: (message: ChatService.IMessage) => void
  ): void {
    const index = this._listeners.indexOf(handler);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  public async getHistory(): Promise<ChatService.ChatHistory> {
    let data: ChatService.ChatHistory = { messages: [] };
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
   * Whether the chat handler is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose the chat handler.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._listeners = [];

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

  /**
   * A function called before transferring the message to the panel(s).
   * Can be useful if some actions are required on the message.
   */
  protected formatChatMessage(
    message: ChatService.IChatMessage
  ): ChatService.IChatMessage {
    return message;
  }

  private _onMessage(message: ChatService.IMessage): void {
    // resolve promise from `sendMessage()`
    if (message.type === 'msg' && message.sender.id === this.id) {
      this._sendResolverQueue.shift()?.(message.id);
    }

    if (message.type === 'msg') {
      message = this.formatChatMessage(message as ChatService.IChatMessage);
    }

    // call listeners in serial
    this._listeners.forEach(listener => listener(message));
  }

  /**
   * Queue of Promise resolvers pushed onto by `send()`
   */
  private _sendResolverQueue: ((value: string) => void)[] = [];

  private _onClose(e: CloseEvent, reject: any) {
    reject(new Error('Chat UI websocket disconnected'));
    console.error('Chat UI websocket disconnected');
    // only attempt re-connect if there was an abnormal closure
    // WebSocket status codes defined in RFC 6455: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1
    if (e.code === 1006) {
      const delaySeconds = 1;
      console.info(`Will try to reconnect in ${delaySeconds} s.`);
      setTimeout(async () => await this._initialize(), delaySeconds * 1000);
    }
  }

  private _initialize(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.isDisposed) {
        return;
      }
      console.log('Creating a new websocket connection for chat...');
      const { token, WebSocket, wsUrl } = this.serverSettings;
      const url =
        URLExt.join(wsUrl, CHAT_SERVICE_URL) +
        (token ? `?token=${encodeURIComponent(token)}` : '');

      const socket = (this._socket = new WebSocket(url));
      socket.onclose = e => this._onClose(e, reject);
      socket.onerror = e => reject(e);
      socket.onmessage = msg =>
        msg.data && this._onMessage(JSON.parse(msg.data));

      const listenForConnection = (message: ChatService.IMessage) => {
        if (message.type !== 'connection') {
          return;
        }
        this.id = message.client_id;
        resolve();
        this.removeListener(listenForConnection);
      };

      this.addListener(listenForConnection);
    });
  }

  private _isDisposed = false;
  private _socket: WebSocket | null = null;
  private _listeners: ((msg: any) => void)[] = [];
}

export namespace ChatHandler {
  /**
   * The instantiation options for a data registry handler.
   */
  export interface IOptions {
    serverSettings?: ServerConnection.ISettings;
  }
}
