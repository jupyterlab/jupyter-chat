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
   * The chat messages list.
   */
  readonly messages: IChatMessage[];

  /**
   * The signal emitted when the messages list is updated.
   */
  readonly messagesUpdated: ISignal<IChatModel, void>;

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not, or nothing if not needed.
   */
  addMessage(message: INewMessage): Promise<boolean | void> | boolean | void;

  /**
   * Optional, to update a message from the chat panel.
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
   * @param message - the message with user information and body.
   */
  onMessage(message: IChatMessage): void;

  /**
   * Function updating the chat messages list.
   *
   * @param index - the index of the messages to add or delete.
   * @param deleted - the number of messages to delete.
   * @param messages - the list of messages to add.
   */
  updateMessagesList(
    index: number,
    deleted: number,
    messages: IChatMessage[]
  ): void;
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
   * The chat messages list.
   */
  get messages(): IChatMessage[] {
    return this._messages;
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
   * The signal emitted when the messages list is updated.
   */
  get messagesUpdated(): ISignal<IChatModel, void> {
    return this._messagesUpdated;
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
   * Optional, to update a message from the chat panel.
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
  onMessage(message: IChatMessage): void {
    const messageIndex = this._messages.findIndex(msg => msg.id === message.id);
    if (messageIndex > -1) {
      // The message is an update of an existing one.
      // Let's remove it to avoid position conflict if timestamp has changed.
      this._messages.splice(messageIndex, 1);
    }
    // Find the first message that should be after this one.
    let nextMsgIndex = this._messages.findIndex(msg => msg.time > message.time);
    if (nextMsgIndex === -1) {
      // There is no message after this one, so let's insert the message at the end.
      nextMsgIndex = this._messages.length;
    }
    // Insert the message.
    this.updateMessagesList(nextMsgIndex, 0, [message]);
  }

  /**
   * Function updating the chat messages list.
   *
   * @param index - the index of the messages to add or delete.
   * @param deleted - the number of messages to delete.
   * @param messages - the list of messages to add.
   */
  updateMessagesList(
    index: number,
    deleted: number = 0,
    messages: IChatMessage[] = []
  ): void {
    const formattedMessages: IChatMessage[] = [];
    messages.forEach(message => {
      formattedMessages.push(this.formatChatMessage(message));
    });

    this._messages.splice(index, deleted, ...formattedMessages);
    this._messagesUpdated.emit();
  }

  private _messages: IChatMessage[] = [];
  private _id: string = '';
  private _config: IConfig;
  private _isDisposed = false;
  private _messagesUpdated = new Signal<IChatModel, void>(this);
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
