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
   * The indexes list of the unread messages.
   */
  unreadMessages: number[];

  /**
   * The indexes list of the messages currently in the viewport.
   */
  messagesInViewport?: number[];

  /**
   * The user connected to the chat panel.
   */
  readonly user?: IUser;

  /**
   * The chat messages list.
   */
  readonly messages: IChatMessage[];

  /**
   * A signal emitting when the messages list is updated.
   */
  readonly messagesUpdated: ISignal<IChatModel, void>;

  /**
   * A signal emitting when unread messages change.
   */
  readonly unreadChanged?: ISignal<IChatModel, number[]>;

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
  messageAdded(message: IChatMessage): void;

  /**
   * Function called when messages are inserted.
   *
   * @param index - the index of the first message of the list.
   * @param messages - the messages list.
   */
  messagesInserted(index: number, messages: IChatMessage[]): void;

  /**
   * Function called when messages are deleted.
   *
   * @param index - the index of the first message to delete.
   * @param count - the number of messages to delete.
   */
  messagesDeleted(index: number, count: number): void;
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
    const config = options.config ?? {};

    // Stack consecutive messages from the same user by default.
    this._config = { stackMessages: true, ...config };
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
    const stackMessagesChanged =
      'stackMessages' in value &&
      this._config.stackMessages !== value?.stackMessages;

    this._config = { ...this._config, ...value };

    if (stackMessagesChanged) {
      if (this._config.stackMessages) {
        this._messages.slice(1).forEach((message, idx) => {
          const previousUser = this._messages[idx].sender.username;
          message.stacked = previousUser === message.sender.username;
        });
      } else {
        this._messages.forEach(message => {
          delete message.stacked;
        });
      }
      this._messagesUpdated.emit();
    }
  }

  /**
   * The indexes list of the unread messages.
   */
  get unreadMessages(): number[] {
    return this._unreadMessages;
  }
  set unreadMessages(unread: number[]) {
    this._unreadMessages = unread;
    this._unreadChanged.emit(this._unreadMessages);
  }

  /**
   * Add unread messages to the list.
   * @param indexes - list of new indexes.
   */
  private _addUnreadMessages(indexes: number[]) {
    indexes.forEach(index => {
      if (!this._unreadMessages.includes(index)) {
        this._unreadMessages.push(index);
      }
    });
    this._unreadChanged.emit(this._unreadMessages);
  }

  /**
   * The indexes list of the messages currently in the viewport.
   */
  get messagesInViewport(): number[] {
    return this._messagesInViewport;
  }
  set messagesInViewport(values: number[]) {
    this._messagesInViewport = values;
  }

  /**
   * A signal emitting when the messages list is updated.
   */
  get messagesUpdated(): ISignal<IChatModel, void> {
    return this._messagesUpdated;
  }

  /**
   * A signal emitting when unread messages change.
   */
  get unreadChanged(): ISignal<IChatModel, number[]> {
    return this._unreadChanged;
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
  messageAdded(message: IChatMessage): void {
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
    this.messagesInserted(nextMsgIndex, [message]);
  }

  /**
   * Function called when messages are inserted.
   *
   * @param index - the index of the first message of the list.
   * @param messages - the messages list.
   */
  messagesInserted(index: number, messages: IChatMessage[]): void {
    const formattedMessages: IChatMessage[] = [];
    const insertedIndexes: number[] = [];

    // Format the messages.
    messages.forEach((message, idx) => {
      formattedMessages.push(this.formatChatMessage(message));
      insertedIndexes.push(index + idx);
    });

    // Insert the messages.
    this._messages.splice(index, 0, ...formattedMessages);

    if (this._config.stackMessages) {
      // Check if some messages should be stacked by comparing each message' sender
      // with the previous one.
      const lastIdx = index + formattedMessages.length - 1;
      const start = index === 0 ? 1 : index;
      const end = this._messages.length > lastIdx + 1 ? lastIdx + 1 : lastIdx;
      for (let idx = start; idx <= end; idx++) {
        const message = this._messages[idx];
        const previousUser = this._messages[idx - 1].sender.username;
        message.stacked = previousUser === message.sender.username;
      }
    }

    this._addUnreadMessages(insertedIndexes);
    this._messagesUpdated.emit();
  }

  /**
   * Function called when messages are deleted.
   *
   * @param index - the index of the first message to delete.
   * @param count - the number of messages to delete.
   */
  messagesDeleted(index: number, count: number): void {
    this._messages.splice(index, count);
    this._messagesUpdated.emit();
  }

  private _messages: IChatMessage[] = [];
  private _unreadMessages: number[] = [];
  private _messagesInViewport: number[] = [];
  private _id: string = '';
  private _config: IConfig;
  private _isDisposed = false;
  private _messagesUpdated = new Signal<IChatModel, void>(this);
  private _unreadChanged = new Signal<IChatModel, number[]>(this);
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
