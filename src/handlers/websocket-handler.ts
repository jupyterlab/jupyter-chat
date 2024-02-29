import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { UUID } from '@lumino/coreutils';

import { requestAPI } from './handler';
import { ChatModel, IChatModel } from '../model';
import { IChatHistory, IMessage, INewMessage } from '../types';

const CHAT_SERVICE_URL = 'api/chat';

export type ConnectionMessage = {
  type: 'connection';
  client_id: string;
};

type GenericMessage = IMessage | ConnectionMessage;

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
    await this._initialize();
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

  onMessage(message: IMessage): void {
    // resolve promise from `sendMessage()`
    if (message.type === 'msg' && message.sender.id === this.id) {
      this._sendResolverQueue.get(message.id)?.(true);
    }

    super.onMessage(message);
  }

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
        msg.data && this.onMessage(JSON.parse(msg.data));

      const listenForConnection = (_: IChatModel, message: GenericMessage) => {
        if (message.type !== 'connection') {
          return;
        }
        this.id = message.client_id;
        resolve();
        this.incomingMessage.disconnect(listenForConnection);
      };

      this.incomingMessage.connect(listenForConnection);
    });
  }

  private _socket: WebSocket | null = null;
  /**
   * Queue of Promise resolvers pushed onto by `send()`
   */
  private _sendResolverQueue = new Map<string, (value: boolean) => void>();
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
