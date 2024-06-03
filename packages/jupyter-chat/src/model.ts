/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { CommandRegistry } from '@lumino/commands';
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
   * The chat model name.
   */
  name: string;

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
   * A signal emitting when the viewport change.
   */
  readonly viewportChanged?: ISignal<IChatModel, number[]>;

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

    this._commands = options.commands;
  }

  /**
   * The chat messages list.
   */
  get messages(): IChatMessage[] {
    return this._messages;
  }

  /**
   * The chat model id.
   */
  get id(): string | undefined {
    return this._id;
  }
  set id(value: string | undefined) {
    this._id = value;
  }

  /**
   * The chat model name.
   */
  get name(): string {
    return this._name;
  }
  set name(value: string) {
    this._name = value;
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
      this._config.stackMessages !== value.stackMessages;

    const unreadNotificationsChanged =
      'unreadNotifications' in value &&
      this._config.unreadNotifications !== value.unreadNotifications;

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

    // remove existing notifications if they are not required anymore.
    if (unreadNotificationsChanged && !this._config.unreadNotifications) {
      this._notify(0);
    }
  }

  /**
   * The indexes list of the unread messages.
   */
  get unreadMessages(): number[] {
    return this._unreadMessages;
  }
  set unreadMessages(unread: number[]) {
    const unreadCountDiff = unread.length - this._unreadMessages.length;
    this._unreadMessages = unread;
    this._unreadChanged.emit(this._unreadMessages);

    // Notify the change.
    this._notify(unread.length, unreadCountDiff > 0);
  }

  /**
   * The indexes list of the messages currently in the viewport.
   */
  get messagesInViewport(): number[] {
    return this._messagesInViewport;
  }
  set messagesInViewport(values: number[]) {
    this._messagesInViewport = values;
    this._viewportChanged.emit(values);
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
   * A signal emitting when the viewport change.
   */
  get viewportChanged(): ISignal<IChatModel, number[]> {
    return this._viewportChanged;
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

  /**
   * Add unread messages to the list.
   * @param indexes - list of new indexes.
   */
  private _addUnreadMessages(indexes: number[]) {
    const unread = new Set(this._unreadMessages);
    indexes.forEach(index => unread.add(index));
    this.unreadMessages = Array.from(unread.values());
  }

  /**
   * Notifications on unread messages.
   *
   * @param unreadCount - number of unread messages.
   *    If the value is 0, existing notification will be deleted.
   * @param canCreate - whether to create a notification if it does not exist.
   *    Usually it is used when there are new unread messages, and not when the
   *    unread messages count decrease.
   */
  private _notify(unreadCount: number, canCreate: boolean = false) {
    if (this._commands) {
      if (unreadCount && this._config.unreadNotifications) {
        // Update the notification if exist.
        this._commands
          .execute('apputils:update-notification', {
            id: this._notificationId,
            message: `${unreadCount} incoming message(s) ${this._name ? 'in ' + this._name : ''}`
          })
          .then(success => {
            // Create a new notification only if messages are added.
            if (!success && canCreate) {
              this._commands!.execute('apputils:notify', {
                type: 'info',
                message: `${unreadCount} incoming message(s) in ${this._name}`
              }).then(id => {
                this._notificationId = id;
              });
            }
          });
      } else if (this._notificationId) {
        // Delete notification if there is no more unread messages.
        this._commands.execute('apputils:dismiss-notification', {
          id: this._notificationId
        });
        this._notificationId = null;
      }
    }
  }

  private _messages: IChatMessage[] = [];
  private _unreadMessages: number[] = [];
  private _messagesInViewport: number[] = [];
  private _id: string | undefined;
  private _name: string = '';
  private _config: IConfig;
  private _isDisposed = false;
  private _commands?: CommandRegistry;
  private _notificationId: string | null = null;
  private _messagesUpdated = new Signal<IChatModel, void>(this);
  private _unreadChanged = new Signal<IChatModel, number[]>(this);
  private _viewportChanged = new Signal<IChatModel, number[]>(this);
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

    /**
     * Commands registry.
     */
    commands?: CommandRegistry;
  }
}
