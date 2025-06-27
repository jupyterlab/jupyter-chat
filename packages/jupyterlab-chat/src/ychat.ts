/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IAttachment, IChatMessage, IUser } from '@jupyter/chat';
import { Delta, DocumentChange, IMapChange, YDocument } from '@jupyter/ydoc';
import { JSONExt, JSONObject, PartialJSONValue, UUID } from '@lumino/coreutils';
import * as Y from 'yjs';

/**
 * The type for a YMessage.
 */
export type IYmessage = IChatMessage<string, string>;

/**
 * The type for a YMessage.
 */
export type IMetadata = PartialJSONValue;

/**
 * Definition of the shared Chat changes.
 */
export interface IChatChanges extends DocumentChange {
  /**
   * Changes in messages.
   */
  messageChanges?: MessageChange;
  /**
   * Changes in users.
   */
  userChanges?: UserChange[];
  /**
   * Changes in attachments.
   */
  attachmentChanges?: AttachmentChange[];
  /**
   * Changes in metadata.
   */
  metadataChanges?: MetadataChange[];
}

/**
 * The message change type.
 */
export type MessageChange = Delta<IYmessage[]>;

/**
 * The user change type.
 */
export type UserChange = IMapChange<IUser>;

/**
 * The attachment change type.
 */
export type AttachmentChange = IMapChange<IAttachment>;

/**
 * The metadata change type.
 */
export type MetadataChange = IMapChange<IMetadata>;

/**
 * The jupyterlab chat shared document.
 */
export class YChat extends YDocument<IChatChanges> {
  /**
   * Create a new jupyterlab chat model.
   */
  constructor(options?: YDocument.IOptions) {
    super(options);
    this._users = this.ydoc.getMap<IUser>('users');
    this._users.observe(this._usersObserver);

    this._messages = this.ydoc.getArray<IYmessage>('messages');
    this._messages.observe(this._messagesObserver);

    this._attachments = this.ydoc.getMap<IAttachment>('attachments');
    this._attachments.observe(this._attachmentsObserver);

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
    return (this._metadata.get('id') as string) || '';
  }

  get users(): Record<string, IUser> {
    const userDict = JSONExt.deepCopy(this._users.toJSON()) as Record<
      string,
      IUser
    >;

    return userDict;
  }

  get messages(): string[] {
    return JSONExt.deepCopy(this._messages.toJSON());
  }

  get attachments(): JSONObject {
    return JSONExt.deepCopy(this._attachments.toJSON());
  }

  getSource(): JSONObject {
    const users = this._users.toJSON();
    const messages = this._messages.toJSON();
    const metadata = this._metadata.toJSON();

    return { users, messages, metadata };
  }

  setSource(value: JSONObject): void {
    if (!value) {
      return;
    }

    this.transact(() => {
      const messages = (value['messages'] as unknown as Array<IYmessage>) ?? [];
      messages.forEach(message => {
        this._messages.push([message]);
      });

      const users = value['users'] ?? {};
      Object.entries(users).forEach(([key, val]) =>
        this._users.set(key, val as IUser)
      );

      const metadata = value['metadata'] ?? {};
      Object.entries(metadata).forEach(([key, val]) =>
        this._metadata.set(key, val as any)
      );
    });
  }

  getUser(username: string | undefined): IUser | undefined {
    if (!username) {
      return undefined;
    }

    return this._users.get(username);
  }

  setUser(user: IUser): void {
    this.transact(() => {
      // call `toJSON()` if the method exists on `user`
      if ('toJSON' in user && typeof user.toJSON === 'function') {
        user = user.toJSON();
      }
      this._users.set(user.username, user);
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

  getAttachment(id: string): IAttachment | undefined {
    return this._attachments.get(id);
  }

  /**
   * Adds or modifies an attachment in the chat, and returns the ID of the
   * attachment.
   *
   * NOTE: this method does not add an attachment to any message. It merely adds
   * the attachment data to the chat file and returns an attachment ID. To add
   * an attachment to a new message, consumers should call this method & add the
   * returned ID to `NewMessage.attachments`.
   */
  setAttachment(attachment: IAttachment): string {
    let id: string;
    if (attachment.selection) {
      // Generate a unique ID if the attachment contains a selection.
      // Attachments with selections are always considered unique because the
      // selection range is generally specific.
      id = UUID.uuid4();
    } else {
      // Otherwise, use the ID of the existing attachment if one exists.
      // Attachments without selections are considered to be identical if they
      // have the same `type` and `value`.
      id =
        Array.from(this._attachments.entries()).find(
          ([_, att]) =>
            att.type === attachment.type && att.value === attachment.value
        )?.[0] || UUID.uuid4();
    }

    // Set the attachment using the computed ID, then return the ID
    this.transact(() => {
      this._attachments.set(id, attachment);
    });
    return id;
  }

  private _usersObserver = (event: Y.YMapEvent<IUser>): void => {
    const userChanges = new Array<UserChange>();
    event.keysChanged.forEach(key => {
      const change = event.changes.keys.get(key);
      if (change) {
        switch (change.action) {
          case 'add':
            userChanges.push({
              key,
              newValue: this._users.get(key),
              type: 'add'
            });
            break;
          case 'delete':
            userChanges.push({
              key,
              oldValue: change.oldValue,
              type: 'remove'
            });
            break;
          case 'update':
            userChanges.push({
              key: key,
              oldValue: change.oldValue,
              newValue: this._users.get(key),
              type: 'change'
            });
            break;
        }
      }
    });

    this._changed.emit({ userChanges } as Partial<IChatChanges>);
  };

  private _messagesObserver = (event: Y.YArrayEvent<IYmessage>): void => {
    const messageChanges = event.delta;
    this._changed.emit({
      messageChanges: messageChanges
    } as Partial<IChatChanges>);
  };

  private _attachmentsObserver = (event: Y.YMapEvent<IAttachment>): void => {
    const attachmentChanges = new Array<AttachmentChange>();
    event.keysChanged.forEach(key => {
      const change = event.changes.keys.get(key);
      if (change) {
        switch (change.action) {
          case 'add':
            attachmentChanges.push({
              key,
              newValue: this._attachments.get(key),
              type: 'add'
            });
            break;
          case 'delete':
            attachmentChanges.push({
              key,
              oldValue: change.oldValue,
              type: 'remove'
            });
            break;
          case 'update':
            attachmentChanges.push({
              key: key,
              oldValue: change.oldValue,
              newValue: this._attachments.get(key),
              type: 'change'
            });
            break;
        }
      }
    });

    this._changed.emit({ attachmentChanges } as Partial<IChatChanges>);
  };

  private _metadataObserver = (event: Y.YMapEvent<IMetadata>): void => {
    const metadataChanges = new Array<MetadataChange>();
    event.changes.keys.forEach((change, key) => {
      switch (change.action) {
        case 'add':
          metadataChanges.push({
            key,
            newValue: this._metadata.get(key),
            type: 'add'
          });
          break;
        case 'delete':
          metadataChanges.push({
            key,
            oldValue: change.oldValue,
            type: 'remove'
          });
          break;
        case 'update':
          metadataChanges.push({
            key: key,
            oldValue: change.oldValue,
            newValue: this._metadata.get(key),
            type: 'change'
          });
          break;
      }
    });

    this._changed.emit({ metadataChanges } as Partial<IChatChanges>);
  };

  private _users: Y.Map<IUser>;
  private _messages: Y.Array<IYmessage>;
  private _attachments: Y.Map<IAttachment>;
  private _metadata: Y.Map<IMetadata>;
}
