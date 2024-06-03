/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatMessage, IUser } from '@jupyter/chat';
import { Delta, DocumentChange, IMapChange, YDocument } from '@jupyter/ydoc';
import { JSONExt, JSONObject, PartialJSONValue } from '@lumino/coreutils';
import * as Y from 'yjs';

/**
 * The type for a YMessage.
 */
export type IYmessage = IChatMessage<string>;

/**
 * The type for a YMessage.
 */
export interface IMetadata {
  /**
   * The id of the chat, stored in the metadata.
   */
  id: string;
  /**
   * Allow any other keys in metadata.
   */
  [anyKey: string]: PartialJSONValue;
}

/**
 * Definition of the shared Chat changes.
 */
export type ChatChange = DocumentChange & {
  /**
   * Changes in messages.
   */
  messageChanges?: MessageChange;
  /**
   * Changes in users.
   */
  userChanges?: UserChange[];
  /**
   * Changes in metadata.
   */
  metadataChanges?: MetadataChange[];
};

/**
 * The message change type.
 */
export type MessageChange = Delta<IYmessage[]>;

/**
 * The user change type.
 */
export type UserChange = IMapChange<IUser>;

/**
 * The metadata change type.
 */
export type MetadataChange = IMapChange<any>;

/**
 * The collaborative chat shared document.
 */
export class YChat extends YDocument<ChatChange> {
  /**
   * Create a new collaborative chat model.
   */
  constructor(options?: YDocument.IOptions) {
    super(options);
    this._users = this.ydoc.getMap<IUser>('users');
    this._users.observe(this._usersObserver);

    this._messages = this.ydoc.getArray<IYmessage>('messages');
    this._messages.observe(this._messagesObserver);

    this._metadata = this.ydoc.getMap<IMetadata>('metadata');
    this._metadata.observe(this._metadataObserver);
  }

  /**
   * Document version
   */
  readonly version: string = '1.0.0';

  /**
   * Static method to create instances on the sharedModel
   *
   * @returns The sharedModel instance
   */
  static create(options?: YDocument.IOptions): YChat {
    return new YChat(options);
  }

  get id(): string {
    const metadata: IMetadata | undefined = this._metadata.get('metadata');
    if (!metadata) {
      return '';
    }
    return metadata?.id || '';
  }

  get users(): JSONObject {
    return JSONExt.deepCopy(this._users.toJSON());
  }

  get messages(): string[] {
    return JSONExt.deepCopy(this._messages.toJSON());
  }

  getUser(username: string | undefined): IUser | undefined {
    if (!username) {
      return undefined;
    }

    return this._users.get(username);
  }

  setUser(value: IUser): void {
    this.transact(() => {
      this._users.set(value.username, value);
    });
  }

  getMessage(index: number): IYmessage | undefined {
    return this._messages.get(index);
  }

  addMessage(value: IYmessage): void {
    this.transact(() => {
      this._messages.push([value]);
    });
  }

  updateMessage(index: number, value: IYmessage): void {
    this.transact(() => {
      this._messages.delete(index);
      this._messages.insert(index, [value]);
    });
  }

  getMessageIndex(id: string): number {
    return this._messages.toArray().findIndex(msg => msg.id === id);
  }

  deleteMessage(index: number): void {
    this.transact(() => {
      this._messages.delete(index);
    });
  }

  private _usersObserver = (event: Y.YMapEvent<IUser>): void => {
    const userChange = new Array<UserChange>();
    event.keysChanged.forEach(key => {
      const change = event.changes.keys.get(key);
      if (change) {
        switch (change.action) {
          case 'add':
            userChange.push({
              key,
              newValue: this._users.get(key),
              type: 'add'
            });
            break;
          case 'delete':
            userChange.push({
              key,
              oldValue: change.oldValue,
              type: 'remove'
            });
            break;
          case 'update':
            userChange.push({
              key: key,
              oldValue: change.oldValue,
              newValue: this._users.get(key),
              type: 'change'
            });
            break;
        }
      }
    });

    this._changed.emit({ userChange: userChange } as Partial<ChatChange>);
  };

  private _messagesObserver = (event: Y.YArrayEvent<IYmessage>): void => {
    const messageChanges = event.delta;
    this._changed.emit({
      messageChanges: messageChanges
    } as Partial<ChatChange>);
  };

  private _metadataObserver = (event: Y.YMapEvent<any>): void => {
    const metadataChange = new Array<any>();
    event.changes.keys.forEach((change, key) => {
      switch (change.action) {
        case 'add':
          metadataChange.push({
            key,
            newValue: this._metadata.get(key),
            type: 'add'
          });
          break;
        case 'delete':
          metadataChange.push({
            key,
            oldValue: change.oldValue,
            type: 'remove'
          });
          break;
        case 'update':
          metadataChange.push({
            key: key,
            oldValue: change.oldValue,
            newValue: this._metadata.get(key),
            type: 'change'
          });
          break;
      }
    });

    this._changed.emit({
      metadataChanges: metadataChange
    } as Partial<ChatChange>);
  };

  private _users: Y.Map<IUser>;
  private _messages: Y.Array<IYmessage>;
  private _metadata: Y.Map<IMetadata>;
}
