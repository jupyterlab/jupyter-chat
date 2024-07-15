/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatModel, IChatMessage, INewMessage, IUser } from '@jupyter/chat';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { User } from '@jupyterlab/services';
import { PartialJSONObject, UUID } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { IWidgetConfig } from './token';
import { IChatChanges, IYmessage, YChat } from './ychat';

/**
 * Collaborative chat namespace.
 */
export namespace CollaborativeChatModel {
  export interface IOptions extends ChatModel.IOptions {
    widgetConfig: IWidgetConfig;
    user: User.IIdentity | null;
    sharedModel?: YChat;
    languagePreference?: string;
  }
}

/**
 * The collaborative chat model.
 */
export class CollaborativeChatModel
  extends ChatModel
  implements DocumentRegistry.IModel
{
  constructor(options: CollaborativeChatModel.IOptions) {
    super(options);

    this._user = options.user || { username: 'user undefined' };

    const { widgetConfig, sharedModel } = options;

    if (sharedModel) {
      this._sharedModel = sharedModel;
    } else {
      this._sharedModel = YChat.create();
    }

    this.id = this._sharedModel.id;

    this.sharedModel.changed.connect(this._onchange, this);

    this.config = widgetConfig.config;

    widgetConfig.configChanged.connect((_, config) => {
      this.config = config;
    });
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

  get disposed(): ISignal<CollaborativeChatModel, void> {
    return this._disposed;
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

  addMessage(message: INewMessage): Promise<boolean | void> | boolean | void {
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

  private _sharedModel: YChat;

  private _dirty = false;
  private _readOnly = false;
  private _disposed = new Signal<this, void>(this);
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);

  private _user: IUser;
}
