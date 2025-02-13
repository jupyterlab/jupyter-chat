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
  IUser,
  IAttachment
} from './types';
import { IActiveCellManager } from './active-cell-manager';
import { ISelectionWatcher } from './selection-watcher';

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
   * Get the active cell manager.
   */
  readonly activeCellManager: IActiveCellManager | null;

  /**
   * Get the selection watcher.
   */
  readonly selectionWatcher: ISelectionWatcher | null;

  /**
   * A signal emitting when the messages list is updated.
   */
  readonly messagesUpdated: ISignal<IChatModel, void>;

  /**
   * A signal emitting when the messages list is updated.
   */
  get configChanged(): ISignal<IChatModel, IConfig>;

  /**
   * A signal emitting when unread messages change.
   */
  readonly unreadChanged?: ISignal<IChatModel, number[]>;

  /**
   * A signal emitting when the viewport change.
   */
  readonly viewportChanged?: ISignal<IChatModel, number[]>;

  /**
   * A signal emitting when the writers change.
   */
  readonly writersChanged?: ISignal<IChatModel, IUser[]>;

  /**
   * A signal emitting when the focus is requested on the input.
   */
  readonly focusInputSignal?: ISignal<IChatModel, void>;

  /**
   * A signal emitting when the input attachments changed.
   */
  readonly inputAttachmentsChanges?: ISignal<IChatModel, IAttachment[]>;

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not, or nothing if not needed.
   */
  sendMessage(message: INewMessage): Promise<boolean | void> | boolean | void;

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

  /**
   * Update the current writers list.
   */
  updateWriters(writers: IUser[]): void;

  /**
   * Function to request the focus on the input of the chat.
   */
  focusInput(): void;

  /**
   * Add attachment to the next message to send.
   */
  addAttachment?(attachment: IAttachment): void;

  /**
   * Remove attachment to the next message to send.
   */
  removeAttachment?(attachment: IAttachment): void;

  /**
   * Clear the attachment list.
   */
  clearAttachments?(): void;

  /**
   * Function called by the input on key pressed.
   */
  inputChanged?(input?: string): void;
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
    if (options.id) {
      this.id = options.id;
    }

    const config = options.config ?? {};

    // Stack consecutive messages from the same user by default.
    this._config = {
      stackMessages: true,
      sendTypingNotification: true,
      ...config
    };

    this._commands = options.commands;

    this._activeCellManager = options.activeCellManager ?? null;

    this._selectionWatcher = options.selectionWatcher ?? null;
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
   * The chat messages list.
   */
  get messages(): IChatMessage[] {
    return this._messages;
  }
  /**
   * Get the active cell manager.
   */
  get activeCellManager(): IActiveCellManager | null {
    return this._activeCellManager;
  }

  /**
   * Get the selection watcher.
   */
  get selectionWatcher(): ISelectionWatcher | null {
    return this._selectionWatcher;
  }

  /**
   * Timestamp of the last read message in local storage.
   */
  get lastRead(): number {
    if (this._id === undefined) {
      return 0;
    }
    const storage = JSON.parse(
      localStorage.getItem(`@jupyter/chat:${this._id}`) || '{}'
    );
    return storage.lastRead ?? 0;
  }
  set lastRead(value: number) {
    if (this._id === undefined) {
      return;
    }
    const storage = JSON.parse(
      localStorage.getItem(`@jupyter/chat:${this._id}`) || '{}'
    );
    storage.lastRead = value;
    localStorage.setItem(`@jupyter/chat:${this._id}`, JSON.stringify(storage));
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

    this._configChanged.emit(this._config);

    // Update the stacked status of the messages and the view.
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
    const recentlyRead = this._unreadMessages.filter(
      elem => !unread.includes(elem)
    );
    const unreadCountDiff = unread.length - this._unreadMessages.length;

    this._unreadMessages = unread;
    this._unreadChanged.emit(this._unreadMessages);

    // Notify the change.
    this._notify(unread.length, unreadCountDiff > 0);

    // Save the last read to the local storage.
    if (this._id !== undefined && recentlyRead.length) {
      let lastReadChanged = false;
      let lastRead = this.lastRead ?? this.messages[recentlyRead[0]].time;
      recentlyRead.forEach(index => {
        if (this.messages[index].time > lastRead) {
          lastRead = this.messages[index].time;
          lastReadChanged = true;
        }
      });

      if (lastReadChanged) {
        this.lastRead = lastRead;
      }
    }
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
   * A signal emitting when the messages list is updated.
   */
  get configChanged(): ISignal<IChatModel, IConfig> {
    return this._configChanged;
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
   * A signal emitting when the writers change.
   */
  get writersChanged(): ISignal<IChatModel, IUser[]> {
    return this._writersChanged;
  }

  /**
   * A signal emitting when the focus is requested on the input.
   */
  get focusInputSignal(): ISignal<IChatModel, void> {
    return this._focusInputSignal;
  }

  /**
   * A signal emitting when the input attachments changed.
   */
  get inputAttachmentsChanges(): ISignal<IChatModel, IAttachment[]> {
    return this._inputAttachmentsChanges;
  }

  /**
   * Send a message, to be defined depending on the chosen technology.
   * Default to no-op.
   *
   * @param message - the message to send.
   * @returns whether the message has been sent or not.
   */
  sendMessage(message: INewMessage): Promise<boolean | void> | boolean | void {}

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
    const unreadIndexes: number[] = [];

    const lastRead = this.lastRead ?? 0;

    // Format the messages.
    messages.forEach((message, idx) => {
      formattedMessages.push(this.formatChatMessage(message));
      if (message.time > lastRead) {
        unreadIndexes.push(index + idx);
      }
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

    this._addUnreadMessages(unreadIndexes);
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
   * Update the current writers list.
   * This implementation only propagate the list via a signal.
   */
  updateWriters(writers: IUser[]): void {
    this._writersChanged.emit(writers);
  }

  /**
   * Function to request the focus on the input of the chat.
   */
  focusInput(): void {
    this._focusInputSignal.emit();
  }

  /**
   * Function called by the input on key pressed.
   */
  inputChanged?(input?: string): void {}

  /**
   * Add attachment to send with next message.
   */
  addAttachment = (attachment: IAttachment): void => {
    const duplicateAttachment = this.inputAttachments.find(
      att => att.type === attachment.type && att.value === attachment.value
    );
    if (duplicateAttachment) {
      return;
    }

    this.inputAttachments.push(attachment);
    this._inputAttachmentsChanges.emit([...this.inputAttachments]);
  };

  /**
   * Remove attachment to be sent.
   */
  removeAttachment = (attachment: IAttachment): void => {
    const attachmentIndex = this.inputAttachments.findIndex(
      att => att.type === attachment.type && att.value === attachment.value
    );
    if (attachmentIndex === -1) {
      return;
    }

    this.inputAttachments.splice(attachmentIndex, 1);
    this._inputAttachmentsChanges.emit([...this.inputAttachments]);
  };

  /**
   * Update attachments.
   */
  clearAttachments = (): void => {
    this.inputAttachments = [];
    this._inputAttachmentsChanges.emit([]);
  };

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

  protected inputAttachments: IAttachment[] = [];
  private _messages: IChatMessage[] = [];
  private _unreadMessages: number[] = [];
  private _messagesInViewport: number[] = [];
  private _id: string | undefined;
  private _name: string = '';
  private _config: IConfig;
  private _isDisposed = false;
  private _commands?: CommandRegistry;
  private _activeCellManager: IActiveCellManager | null;
  private _selectionWatcher: ISelectionWatcher | null;
  private _notificationId: string | null = null;
  private _messagesUpdated = new Signal<IChatModel, void>(this);
  private _configChanged = new Signal<IChatModel, IConfig>(this);
  private _unreadChanged = new Signal<IChatModel, number[]>(this);
  private _viewportChanged = new Signal<IChatModel, number[]>(this);
  private _writersChanged = new Signal<IChatModel, IUser[]>(this);
  private _focusInputSignal = new Signal<ChatModel, void>(this);
  private _inputAttachmentsChanges = new Signal<ChatModel, IAttachment[]>(this);
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
     * The id of the chat.
     */
    id?: string;

    /**
     * Initial config for the chat widget.
     */
    config?: IConfig;

    /**
     * Commands registry.
     */
    commands?: CommandRegistry;

    /**
     * Active cell manager.
     */
    activeCellManager?: IActiveCellManager | null;

    /**
     * Selection watcher.
     */
    selectionWatcher?: ISelectionWatcher | null;
  }
}
