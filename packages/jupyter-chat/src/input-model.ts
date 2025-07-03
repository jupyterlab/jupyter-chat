/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';
import { IActiveCellManager } from './active-cell-manager';
import { ISelectionWatcher } from './selection-watcher';
import { IChatContext } from './model';
import { IAttachment, IUser } from './types';

/**
 * The chat input interface.
 */
export interface IInputModel extends IDisposable {
  /**
   * The chat context (a readonly subset of the chat model).
   */
  readonly chatContext: IChatContext;

  /**
   * Function to send a message.
   */
  send: (content: string) => void;

  /**
   * Optional function to cancel edition.
   */
  cancel: (() => void) | undefined;

  /**
   * The entire input value.
   */
  value: string;

  /**
   * A signal emitting when the value has changed.
   */
  readonly valueChanged: ISignal<IInputModel, string>;

  /**
   * The current cursor index.
   * This refers to the index of the character in front of the cursor.
   */
  cursorIndex: number | null;

  /**
   * A signal emitting when the cursor position has changed.
   */
  readonly cursorIndexChanged: ISignal<IInputModel, number | null>;

  /**
   * The current word behind the user's cursor, space-separated.
   */
  readonly currentWord: string | null;

  /**
   * A signal emitting when the current word has changed.
   */
  readonly currentWordChanged: ISignal<IInputModel, string | null>;

  /**
   * Get the active cell manager.
   */
  readonly activeCellManager: IActiveCellManager | null;

  /**
   * Get the selection watcher.
   */
  readonly selectionWatcher: ISelectionWatcher | null;

  /**
   * Get the document manager.
   */
  readonly documentManager: IDocumentManager | null;

  /**
   * The input configuration.
   */
  config: InputModel.IConfig;

  /**
   * A signal emitting when the messages list is updated.
   */
  readonly configChanged: ISignal<IInputModel, InputModel.IConfig>;

  /**
   * Function to request the focus on the input of the chat.
   */
  focus(): void;

  /**
   * A signal emitting when the focus is requested on the input.
   */
  readonly focusInputSignal?: ISignal<IInputModel, void>;

  /**
   * The attachments list.
   */
  readonly attachments: IAttachment[];

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
  clearAttachments(): void;

  /**
   * A signal emitting when the attachment list has changed.
   */
  readonly attachmentsChanged?: ISignal<IInputModel, IAttachment[]>;

  /**
   * Replace the current word in the input with a new one.
   */
  replaceCurrentWord(newWord: string): void;

  /**
   * The mentioned user list.
   */
  readonly mentions: IUser[];

  /**
   * Add user mention.
   */
  addMention?(user: IUser): void;

  /**
   * Remove a user mention.
   */
  removeMention(user: IUser): void;

  /**
   * Clear mentions list.
   */
  clearMentions(): void;

  /**
   * A signal emitting when disposing of the model.
   */
  readonly onDisposed: ISignal<InputModel, void>;
}

/**
 * The input model.
 */
export class InputModel implements IInputModel {
  constructor(options: InputModel.IOptions) {
    this._onSend = options.onSend;
    this._chatContext = options.chatContext;
    this._value = options.value || '';
    this._attachments = options.attachments || [];
    this._mentions = options.mentions || [];
    this.cursorIndex = options.cursorIndex || this.value.length;
    this._activeCellManager = options.activeCellManager ?? null;
    this._selectionWatcher = options.selectionWatcher ?? null;
    this._documentManager = options.documentManager ?? null;
    this._config = {
      ...options.config
    };
    this.cancel = options.onCancel;
  }

  /**
   * The chat context (a readonly subset of the chat model);
   */
  get chatContext(): IChatContext {
    return this._chatContext;
  }

  /**
   * Function to send a message.
   */
  send = (input: string): void => {
    this._onSend(input, this);
    this.value = '';
  };

  /**
   * Optional function to cancel edition.
   */
  cancel: (() => void) | undefined;

  /**
   * The entire input value.
   */
  get value(): string {
    return this._value;
  }
  set value(newInput: string) {
    this._value = newInput;
    this._valueChanged.emit(newInput);
  }

  /**
   * A signal emitting when the value has changed.
   */
  get valueChanged(): ISignal<IInputModel, string> {
    return this._valueChanged;
  }

  /**
   * The cursor position in the input.
   */
  get cursorIndex(): number | null {
    return this._cursorIndex;
  }
  set cursorIndex(newIndex: number | null) {
    if (newIndex === null || newIndex > this._value.length) {
      return;
    }
    this._cursorIndex = newIndex;
    this._cursorIndexChanged.emit(newIndex);

    if (this._cursorIndex === null) {
      return;
    }
    const currentWord = Private.getCurrentWord(this._value, this._cursorIndex);
    if (currentWord !== this._currentWord) {
      this._currentWord = currentWord;
      this._currentWordChanged.emit(this._currentWord);
    }
  }

  /**
   * A signal emitting when the cursor position has changed.
   */
  get cursorIndexChanged(): ISignal<IInputModel, number | null> {
    return this._cursorIndexChanged;
  }

  /**
   * The current word behind the user's cursor, space-separated.
   */
  get currentWord(): string | null {
    return this._currentWord;
  }

  /**
   * A signal emitting when the current word has changed.
   */
  get currentWordChanged(): ISignal<IInputModel, string | null> {
    return this._currentWordChanged;
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
   * Get the document manager.
   */
  get documentManager(): IDocumentManager | null {
    return this._documentManager;
  }

  /**
   * The input configuration.
   */
  get config(): InputModel.IConfig {
    return this._config;
  }
  set config(value: Partial<InputModel.IConfig>) {
    this._config = { ...this._config, ...value };
    this._configChanged.emit(this._config);
  }

  /**
   * A signal emitting when the configuration is updated.
   */
  get configChanged(): ISignal<IInputModel, InputModel.IConfig> {
    return this._configChanged;
  }

  /**
   * Function to request the focus on the input of the chat.
   */
  focus(): void {
    this._focusInputSignal.emit();
  }

  /**
   * A signal emitting when the focus is requested on the input.
   */
  get focusInputSignal(): ISignal<IInputModel, void> {
    return this._focusInputSignal;
  }

  /**
   * The attachments list.
   */
  get attachments(): IAttachment[] {
    return this._attachments;
  }

  /**
   * Add attachment to send with next message.
   */
  addAttachment = (attachment: IAttachment): void => {
    // Use JSON comparison to detect duplicates (same as in YChat.setAttachment)
    const attachmentJson = JSON.stringify(attachment);
    const duplicateAttachment = this._attachments.find(
      att => JSON.stringify(att) === attachmentJson
    );
    if (duplicateAttachment) {
      return;
    }

    this._attachments.push(attachment);
    this._attachmentsChanged.emit([...this._attachments]);
  };

  /**
   * Remove attachment to be sent.
   */
  removeAttachment = (attachment: IAttachment): void => {
    // Use JSON comparison to detect duplicates (same as in YChat.setAttachment)
    const attachmentJson = JSON.stringify(attachment);
    const attachmentIndex = this._attachments.findIndex(
      att => JSON.stringify(att) === attachmentJson
    );
    if (attachmentIndex === -1) {
      return;
    }

    this._attachments.splice(attachmentIndex, 1);
    this._attachmentsChanged.emit([...this._attachments]);
  };

  /**
   * Update attachments.
   */
  clearAttachments = (): void => {
    this._attachments = [];
    this._attachmentsChanged.emit([]);
  };

  /**
   * A signal emitting when the input attachments changed.
   */
  get attachmentsChanged(): ISignal<IInputModel, IAttachment[]> {
    return this._attachmentsChanged;
  }

  /**
   * Replace the current word in the input with a new one.
   */
  replaceCurrentWord(newWord: string): void {
    if (this.cursorIndex === null) {
      return;
    }
    const [start, end] = Private.getCurrentWordBoundaries(
      this.value,
      this.cursorIndex
    );
    this.value = this.value.slice(0, start) + newWord + this.value.slice(end);
  }

  /**
   * The mentioned user list.
   */
  get mentions(): IUser[] {
    return this._mentions;
  }

  /**
   * Add a user mention.
   */
  addMention(user: IUser): void {
    const usernames = this._mentions.map(user => user.username);
    if (!usernames.includes(user.username)) {
      this._mentions.push(user);
    }
  }

  /**
   * Remove a user mention.
   */
  removeMention(user: IUser): void {
    const index = this._mentions.indexOf(user);
    if (index > -1) {
      this._mentions.splice(index, 1);
    }
  }

  /**
   * Clear mentions list.
   */
  clearMentions = (): void => {
    this._mentions = [];
  };

  /**
   * Dispose the input model.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._onDisposed.emit();
    this._isDisposed = true;
  }

  /**
   * A signal emitting when disposing of the model.
   */
  get onDisposed(): ISignal<InputModel, void> {
    return this._onDisposed;
  }

  /**
   * Whether the input model is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  private _onSend: (input: string, model?: InputModel) => void;
  private _chatContext: IChatContext;
  private _value: string;
  private _cursorIndex: number | null = null;
  private _currentWord: string | null = null;
  private _attachments: IAttachment[];
  private _mentions: IUser[];
  private _activeCellManager: IActiveCellManager | null;
  private _selectionWatcher: ISelectionWatcher | null;
  private _documentManager: IDocumentManager | null;
  private _config: InputModel.IConfig;
  private _valueChanged = new Signal<IInputModel, string>(this);
  private _cursorIndexChanged = new Signal<IInputModel, number | null>(this);
  private _currentWordChanged = new Signal<IInputModel, string | null>(this);
  private _configChanged = new Signal<IInputModel, InputModel.IConfig>(this);
  private _focusInputSignal = new Signal<InputModel, void>(this);
  private _attachmentsChanged = new Signal<InputModel, IAttachment[]>(this);
  private _onDisposed = new Signal<InputModel, void>(this);
  private _isDisposed = false;
}

export namespace InputModel {
  export interface IOptions {
    /**
     * The chat context (a readonly subset of the chat model).
     */
    chatContext: IChatContext;

    /**
     * The function that should send the message.
     * @param content - the content of the message.
     * @param model - the model of the input sending the message.
     */
    onSend: (content: string, model?: InputModel) => void;

    /**
     * Function that should cancel the message edition.
     */
    onCancel?: () => void;

    /**
     * The initial value of the input.
     */
    value?: string;

    /**
     * The initial attachments.
     */
    attachments?: IAttachment[];

    /**
     * The initial mentions.
     */
    mentions?: IUser[];

    /**
     * The current cursor index.
     * This refers to the index of the character in front of the cursor.
     */
    cursorIndex?: number;

    /**
     * The configuration for the input component.
     */
    config?: IConfig;

    /**
     * Active cell manager.
     */
    activeCellManager?: IActiveCellManager | null;

    /**
     * Selection watcher.
     */
    selectionWatcher?: ISelectionWatcher | null;

    /**
     * Document manager.
     */
    documentManager?: IDocumentManager | null;
  }

  export interface IConfig {
    /**
     * Whether to send a message via Shift-Enter instead of Enter.
     */
    sendWithShiftEnter?: boolean;
  }
}

namespace Private {
  const WHITESPACE = new Set([' ', '\n', '\t']);

  /**
   * Returns the start index (inclusive) & end index (exclusive) that contain
   * the current word. The start & end index can be passed to `String.slice()`
   * to extract the current word. The returned range never includes any
   * whitespace character unless it is escaped by a backslash `\`.
   *
   * NOTE: the escape sequence handling here is naive and non-recursive. This
   * function considers the space in "`\\ `" as escaped, even though "`\\ `"
   * defines a backslash followed by an _unescaped_ space in most languages.
   */
  export function getCurrentWordBoundaries(
    input: string,
    cursorIndex: number
  ): [number, number] {
    let start = cursorIndex;
    let end = cursorIndex;
    const n = input.length;

    while (
      // terminate when `input[start - 1]` is whitespace
      // i.e. `input[start]` is never whitespace after exiting
      (start - 1 >= 0 && !WHITESPACE.has(input[start - 1])) ||
      // unless it is preceded by a backslash
      (start - 2 >= 0 &&
        input[start - 2] === '\\' &&
        WHITESPACE.has(input[start - 1]))
    ) {
      start--;
    }

    // `end` is an exclusive index unlike `start`, hence the different `while`
    // condition here
    while (
      // terminate when `input[end]` is whitespace
      // i.e. `input[end]` may be whitespace after exiting
      (end < n && !WHITESPACE.has(input[end])) ||
      // unless it is preceded by a backslash
      (end < n &&
        end - 1 >= 0 &&
        input[end - 1] === '\\' &&
        WHITESPACE.has(input[end]))
    ) {
      end++;
    }

    return [start, end];
  }

  /**
   * Gets the current (space-separated) word around the user's cursor. The current
   * word is used to generate a list of matching chat commands.
   */
  export function getCurrentWord(
    input: string,
    cursorIndex: number
  ): string | null {
    const [start, end] = getCurrentWordBoundaries(input, cursorIndex);
    return input.slice(start, end);
  }
}
