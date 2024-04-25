/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatModel,
  IChatMessage,
  IDeleteMessage,
  INewMessage,
  IUser
} from '@jupyter/chat';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { PartialJSONObject, UUID } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { Awareness } from 'y-protocols/awareness';

import { IWidgetConfig } from './token';
import { ChatChange, IYmessage, YChat } from './ychat';

/**
 * Collaborative chat namespace.
 */
export namespace CollaborativeChatModel {
  export interface IOptions extends ChatModel.IOptions {
    awareness: Awareness;
    widgetConfig: IWidgetConfig;
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

    this._awareness = options.awareness;
    const { widgetConfig, sharedModel } = options;

    if (sharedModel) {
      this._sharedModel = sharedModel;
    } else {
      this._sharedModel = YChat.create();
    }

    this.sharedModel.changed.connect(this._onchange, this);

    this.config = widgetConfig.config;

    this._user = this._awareness.states.get(this._awareness.clientID)?.user;

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

  initialize(): void {
    //
  }

  /**
   * A function called before transferring the message to the panel(s).
   * Can be useful if some actions are required on the message.
   *
   * It is used in this case to retrieve the user avatar color, unknown on server side.
   */
  protected formatChatMessage(message: IChatMessage): IChatMessage {
    if (this._awareness) {
      if (typeof message.sender !== 'string') {
        // const sender = message.sender as IUser;
        const sender = Array.from(this._awareness.states.values()).find(
          awareness =>
            awareness.user.username === (message.sender as IUser).username
        )?.user;
        if (sender) {
          message.sender.color = sender.color;
        }
      }
    }
    return message;
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
      this.sharedModel.transact(
        () => void this.sharedModel.setUser(this._user)
      );
    }
    this.sharedModel.transact(() => void this.sharedModel.setMessage(msg));
  }

  private _onchange = (_: YChat, change: ChatChange) => {
    if (change.messageChanges) {
      const msgChange = change.messageChanges;
      const messages: IYmessage[] = [];
      const deletedMessages: IYmessage[] = [];
      msgChange.forEach(data => {
        if (['add', 'change'].includes(data.type) && data.newValue) {
          messages.push(data.newValue);
        } else if (data.type === 'remove' && data.oldValue) {
          deletedMessages.push(data.oldValue);
        }
      });
      if (messages) {
        messages.forEach(message => {
          const msg: IChatMessage = { ...message };
          msg.sender =
            this.sharedModel.getUser(message.sender) || message.sender;
          this.onMessage(msg);
        });
      }
      if (deletedMessages) {
        deletedMessages.forEach(message => {
          const msg: IDeleteMessage = {
            type: 'remove',
            id: message.id
          };
          this.onMessage(msg);
        });
      }
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

  private _awareness: Awareness;
  private _user: IUser;
}
