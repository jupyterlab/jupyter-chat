/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';

import {
  IChatHistory,
  INewMessage,
  IChatMessage,
  IConfig,
  IMessage,
  IUser
} from './types';

/**
 * The chat model interface.
 */
export interface IChatModel extends IDisposable {
  /**
   * The chat model ID.
   */
  id: string;

  /**
   * The configuration for the chat panel.
   */
  config: IConfig;

  /**
   * The user connected to the chat panel.
   */
  readonly user?: IUser;

  /**
   * The signal emitted when a new message is received.
   */
  get incomingMessage(): ISignal<IChatModel, IMessage>;

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not, or nothing if not needed.
   */
  addMessage(message: INewMessage): Promise<boolean | void> | boolean | void;

  /**
   * Optional, to update a message from the chat.
   *
   * @param id - the unique ID of the message.
   * @param message - the updated message.
   */
  updateMessage?(
    id: string,
    message: IChatMessage
  ): Promise<boolean | void> | boolean | void;

  /**
   * Optional, to delete a message from the chat.
   *
   * @param id - the unique ID of the message.
   */
  deleteMessage?(id: string): Promise<boolean | void> | boolean | void;

  /**
   * Optional, to get messages history.
   */
  getHistory?(): Promise<IChatHistory>;

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
  onMessage(message: IMessage): void;
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
  constructor(options: ChatModel.IOptions = {}) {
    this._config = options.config ?? {};
  }

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
   * The chat settings.
   */
  get config(): IConfig {
    return this._config;
  }
  set config(value: Partial<IConfig>) {
    this._config = { ...this._config, ...value };
  }

  /**
   *
   * The signal emitted when a new message is received.
   */
  get incomingMessage(): ISignal<IChatModel, IMessage> {
    return this._incomingMessage;
  }

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not.
   */
  addMessage(message: INewMessage): Promise<boolean | void> | boolean | void {}

  /**
   * Optional, to update a message from the chat.
   *
   * @param id - the unique ID of the message.
   * @param message - the message to update.
   */
  updateMessage?(
    id: string,
    message: INewMessage
  ): Promise<boolean | void> | boolean | void;

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
  protected formatChatMessage(message: IChatMessage): IChatMessage {
    return message;
  }

  /**
   * Function to call when a message is received.
   *
   * @param message - the message with user information and body.
   */
  onMessage(message: IMessage): void {
    if (message.type === 'msg') {
      message = this.formatChatMessage(message as IChatMessage);
    }

    this._incomingMessage.emit(message);
  }

  private _id: string = '';
  private _config: IConfig;
  private _isDisposed = false;
  private _incomingMessage = new Signal<IChatModel, IMessage>(this);
}

/**
 * The chat model namespace.
 */
export namespace ChatModel {
  /**
   * The instantiation options for a ChatModel.
   */
  export interface IOptions {
    /**
     * Initial config for the chat widget.
     */
    config?: IConfig;
  }
}
