/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatModel, IChatMessage, INewMessage, IUser } from '@jupyter/chat';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { User } from '@jupyterlab/services';
import { PartialJSONObject, PromiseDelegate, UUID } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { IWidgetConfig } from './token';
import { IChatChanges, IYmessage, YChat } from './ychat';

const WRITING_DELAY = 1000;

/**
 * Chat model namespace.
 */
export namespace LabChatModel {
  export interface IOptions extends ChatModel.IOptions {
    widgetConfig: IWidgetConfig;
    user: User.IIdentity | null;
    sharedModel?: YChat;
    languagePreference?: string;
  }
}

/**
 * The chat model.
 */
export class LabChatModel extends ChatModel implements DocumentRegistry.IModel {
  constructor(options: LabChatModel.IOptions) {
    super(options);

    this._user = options.user || { username: 'user undefined' };

    const { widgetConfig, sharedModel } = options;

    if (sharedModel) {
      this._sharedModel = sharedModel;
    } else {
      this._sharedModel = YChat.create();
    }

    this.sharedModel.changed.connect(this._onchange, this);

    this.config = widgetConfig.config;

    widgetConfig.configChanged.connect((_, config) => {
      this.config = config;
    });

    this.sharedModel.awareness.on('change', this.onAwarenessChange);
  }

  readonly collaborative = true;

  get user(): IUser {
    return this._user;
  }

  get sharedModel(): YChat {
    return this._sharedModel;
  }

  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  get stateChanged(): ISignal<this, IChangedArgs<any, any, string>> {
    return this._stateChanged;
  }

  get dirty(): boolean {
    return this._dirty;
  }
  set dirty(value: boolean) {
    this._dirty = value;
  }

  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(value: boolean) {
    this._readOnly = value;
  }

  get disposed(): ISignal<LabChatModel, void> {
    return this._disposed;
  }

  set id(value: string | undefined) {
    super.id = value;
    if (value) {
      this._ready.resolve();
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    super.dispose();
    this._sharedModel.dispose();
    this._disposed.emit();
    Signal.clearData(this);
  }

  toString(): string {
    return JSON.stringify({}, null, 2);
  }

  fromString(data: string): void {
    /** */
  }

  toJSON(): PartialJSONObject {
    return JSON.parse(this.toString());
  }

  fromJSON(data: PartialJSONObject): void {
    // nothing to do
  }

  messagesInserted(index: number, messages: IChatMessage[]): void {
    // Ensure the chat has an ID before inserting the messages, to properly catch the
    // unread messages (the last read message is saved using the chat ID).
    this._ready.promise.then(() => {
      super.messagesInserted(index, messages);
    });
  }

  sendMessage(message: INewMessage): Promise<boolean | void> | boolean | void {
    this._resetWritingStatus();
    if (this._timeoutWriting !== null) {
      window.clearTimeout(this._timeoutWriting);
    }
    const msg: IYmessage = {
      type: 'msg',
      id: UUID.uuid4(),
      body: message.body,
      time: Date.now() / 1000,
      sender: this._user.username,
      raw_time: true
    };

    // Add the user if it does not exist or has changed
    if (!(this.sharedModel.getUser(this._user.username) === this._user)) {
      this.sharedModel.setUser(this._user);
    }
    this.sharedModel.addMessage(msg);
  }

  updateMessage(
    id: string,
    updatedMessage: IChatMessage
  ): Promise<boolean | void> | boolean | void {
    const index = this.sharedModel.getMessageIndex(id);
    let message = this.sharedModel.getMessage(index);
    if (message) {
      message.body = updatedMessage.body;
      message.edited = true;
    } else {
      const sender = updatedMessage.sender.username;

      message = {
        type: 'msg',
        id: id || UUID.uuid4(),
        body: updatedMessage.body,
        time: updatedMessage.time || Date.now() / 1000,
        sender: sender,
        edited: true
      };
    }
    this.sharedModel.updateMessage(index, message as IYmessage);
  }

  deleteMessage(id: string): Promise<boolean | void> | boolean | void {
    const index = this.sharedModel.getMessageIndex(id);
    const message = this.sharedModel.getMessage(index);
    if (!message) {
      console.error('The message to delete does not exist');
      return;
    }
    message.body = '';
    message.deleted = true;
    this.sharedModel.updateMessage(index, message);
  }

  /**
   * Function called by the input on key pressed.
   */
  inputChanged(input?: string): void {
    if (!input || !this.config.sendTypingNotification) {
      return;
    }
    const awareness = this.sharedModel.awareness;
    if (this._timeoutWriting !== null) {
      window.clearTimeout(this._timeoutWriting);
    }
    awareness.setLocalStateField('isWriting', true);
    this._timeoutWriting = window.setTimeout(() => {
      this._resetWritingStatus();
    }, WRITING_DELAY);
  }

  /**
   * Triggered when an awareness state changes.
   * Used to populate the writers list.
   */
  onAwarenessChange = () => {
    const writers: IUser[] = [];
    const states = this.sharedModel.awareness.getStates();
    for (const stateID of states.keys()) {
      const state = states.get(stateID);
      if (!state || !state.user || state.user.username === this.user.username) {
        continue;
      }
      if (state.isWriting) {
        writers.push(state.user);
      }
    }
    this.updateWriters(writers);
  };

  private _resetWritingStatus() {
    const awareness = this.sharedModel.awareness;
    const states = awareness.getLocalState();
    delete states?.isWriting;
    awareness.setLocalState(states);
    this._timeoutWriting = null;
  }

  private _onchange = (_: YChat, changes: IChatChanges) => {
    if (changes.messageChanges) {
      const msgDelta = changes.messageChanges;
      let index = 0;
      msgDelta.forEach(delta => {
        if (delta.retain) {
          index += delta.retain;
        } else if (delta.insert) {
          const messages = delta.insert.map(ymessage => {
            const msg: IChatMessage = {
              ...ymessage,
              sender: this.sharedModel.getUser(ymessage.sender) || {
                username: 'User undefined'
              }
            };

            return msg;
          });
          this.messagesInserted(index, messages);
          index += messages.length;
        } else if (delta.delete) {
          this.messagesDeleted(index, delta.delete);
        }
      });
    }

    if (changes.metadataChanges) {
      changes.metadataChanges.forEach(change => {
        // no need to search for update or add, if the new value contains ID, let's
        // update the model ID.
        if (change.key === 'id') {
          this.id = change.newValue as string;
        }
      });
    }
  };

  readonly defaultKernelName: string = '';
  readonly defaultKernelLanguage: string = '';

  private _ready = new PromiseDelegate<void>();
  private _sharedModel: YChat;

  private _dirty = false;
  private _readOnly = false;
  private _disposed = new Signal<this, void>(this);
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _timeoutWriting: number | null = null;

  private _user: IUser;
}
