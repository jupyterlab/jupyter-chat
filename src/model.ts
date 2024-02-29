import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';

import { ChatService } from './services';

export interface IChatModel extends IDisposable {
  /**
   * The chat model ID.
   */
  id: string;

  /**
   * The signal emitted when a new message is received.
   */
  get incomingMessage(): ISignal<IChatModel, ChatService.IMessage>;

  /**
   * The signal emitted when a message is updated.
   */
  get messageUpdated(): ISignal<IChatModel, ChatService.IMessage>;

  /**
   * The signal emitted when a message is updated.
   */
  get messageDeleted(): ISignal<IChatModel, ChatService.IMessage>;

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not, or nothing if not needed.
   */
  sendMessage(
    message: ChatService.ChatRequest
  ): Promise<boolean | void> | boolean | void;

  /**
   * Optional, to update a message from the chat.
   *
   * @param id - the unique ID of the message.
   * @param message - the message to update.
   */
  updateMessage?(
    id: string,
    message: ChatService.ChatRequest
  ): Promise<boolean | void> | boolean | void;

  /**
   * Optional, to get messages history.
   */
  getHistory?(): Promise<ChatService.ChatHistory>;

  /**
   * Dispose the chat model.
   */
  dispose(): void;

  /**
   * Whether the chat handler is disposed.
   */
  isDisposed: boolean;

  /**
   * Function to call when a message is received.
   *
   * @param message - the new message, containing user information and body.
   */
  onMessage(message: ChatService.IMessage): void;

  /**
   * Function to call when a message is updated.
   *
   * @param message - the message updated, containing user information and body.
   */
  onMessageUpdated?(message: ChatService.IMessage): void;
}

/**
 * The default chat model implementation.
 * It is not able to send or update a message by itself, since it depends on the
 * chosen technology.
 */
export class ChatModel implements IChatModel {
  /**
   * Create a new chat model.
   */
  constructor(options: ChatModel.IOptions = {}) {}

  /**
   * The chat model ID.
   */
  get id(): string {
    return this._id;
  }
  set id(value: string) {
    this._id = value;
  }

  /**
   * The signal emitted when a new message is received.
   */
  get incomingMessage(): ISignal<IChatModel, ChatService.IMessage> {
    return this._incomingMessage;
  }

  /**
   * The signal emitted when a message is updated.
   */
  get messageUpdated(): ISignal<IChatModel, ChatService.IMessage> {
    return this._messageUpdated;
  }

  /**
   * The signal emitted when a message is updated.
   */
  get messageDeleted(): ISignal<IChatModel, ChatService.IMessage> {
    return this._messageDeleted;
  }

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not.
   */
  sendMessage(
    message: ChatService.ChatRequest
  ): Promise<boolean | void> | boolean | void {}

  /**
   * Dispose the chat model.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
  }

  /**
   * Whether the chat handler is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
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

  /**
   * Function to call when a message is received.
   *
   * @param message - the message with user information and body.
   */
  onMessage(message: ChatService.IMessage): void {
    if (message.type === 'msg') {
      message = this.formatChatMessage(message as ChatService.IChatMessage);
    }

    this._incomingMessage.emit(message);
  }

  private _id: string = '';
  private _isDisposed = false;
  private _incomingMessage = new Signal<IChatModel, ChatService.IMessage>(this);
  private _messageUpdated = new Signal<IChatModel, ChatService.IChatMessage>(
    this
  );
  private _messageDeleted = new Signal<IChatModel, ChatService.IChatMessage>(
    this
  );
}

/**
 * The chat model namespace.
 */
export namespace ChatModel {
  /**
   * The instantiation options for a ChatModel.
   */
  export interface IOptions {}
}
