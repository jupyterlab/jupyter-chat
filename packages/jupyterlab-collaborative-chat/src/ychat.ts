/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatMessage, IUser } from '@jupyter/chat';
import { DocumentChange, IMapChange, YDocument } from '@jupyter/ydoc';
import { JSONExt, JSONObject } from '@lumino/coreutils';
import * as Y from 'yjs';

/**
 * Definition of the shared Chat changes.
 */
export type ChatChange = DocumentChange & {
  /**
   * Changes in messages.
   */
  messageChanges?: MessageChange[];
  /**
   * Changes in users.
   */
  userChanges?: UserChange[];
};

/**
 * The message change type.
 */
export type MessageChange = IMapChange<IYmessage>;

/**
 * The user change type.
 */
export type UserChange = IMapChange<IUser>;

/**
 * The interface for a YMessage.
 */
export interface IYmessage extends IChatMessage {
  /**
   * The username of the message sender.
   */
  sender: string;
}

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

    this._messages = this.ydoc.getMap<IYmessage>('messages');
    this._messages.observe(this._messagesObserver);
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

  get users(): JSONObject {
    return JSONExt.deepCopy(this._users.toJSON());
  }

  get messages(): JSONObject {
    return JSONExt.deepCopy(this._messages.toJSON());
  }

  getUser(username: string | undefined): IUser | undefined {
    if (!username) {
      return undefined;
    }

    return this._users.get(username);
  }

  setUser(value: IUser): void {
    this._users.set(value.username, value);
  }

  setMessage(value: IYmessage): void {
    this._messages.set(value.id, value);
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

    this._changed.emit({ userChange: userChange } as any);
  };

  private _messagesObserver = (event: Y.YMapEvent<IYmessage>): void => {
    const messageChanges = new Array<MessageChange>();
    event.keysChanged.forEach(key => {
      const change = event.changes.keys.get(key);
      if (change) {
        switch (change.action) {
          case 'add':
            messageChanges.push({
              key,
              newValue: this._messages.get(key),
              type: 'add'
            });
            break;
          case 'delete':
            messageChanges.push({
              key,
              oldValue: change.oldValue,
              type: 'remove'
            });
            break;
          case 'update':
            messageChanges.push({
              key: key,
              oldValue: change.oldValue,
              newValue: this._messages.get(key),
              type: 'change'
            });
            break;
        }
      }
    });

    this._changed.emit({ messageChanges: messageChanges } as any);
  };

  private _users: Y.Map<IUser>;
  private _messages: Y.Map<IYmessage>;
}
