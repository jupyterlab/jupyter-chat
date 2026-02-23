/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMime } from '@jupyterlab/rendermime';
import { ISignal, Signal } from '@lumino/signaling';
import {
  IAttachment,
  IMessageContent,
  IMessage,
  IMessageMetadata,
  IUser
} from './types';

/**
 * The message object.
 */
export class Message implements IMessage {
  /**
   * The constructor of the message.
   *
   * @param content: the content of the message.
   */
  constructor(content: IMessageContent) {
    this._content = content;
  }

  /**
   * The message content.
   */
  get content(): IMessageContent {
    return this._content;
  }

  /**
   * Getters for each attribute individually.
   */
  get type(): string {
    return this._content.type;
  }
  get body():
    | string
    | (Partial<IRenderMime.IMimeModel> & Pick<IRenderMime.IMimeModel, 'data'>) {
    return this._content.body;
  }
  get id(): string {
    return this._content.id;
  }
  get time(): number {
    return this._content.time;
  }
  get sender(): IUser {
    return this._content.sender;
  }
  get attachments(): IAttachment[] | undefined {
    return this._content.attachments;
  }
  get mentions(): IUser[] | undefined {
    return this._content.mentions;
  }
  get raw_time(): boolean | undefined {
    return this._content.raw_time;
  }
  get deleted(): boolean | undefined {
    return this._content.deleted;
  }
  get edited(): boolean | undefined {
    return this._content.edited;
  }
  get stacked(): boolean | undefined {
    return this._content.stacked;
  }
  get metadata(): IMessageMetadata | undefined {
    return this._content.metadata;
  }

  /**
   * A signal emitting when the message has been updated.
   */
  get changed(): ISignal<IMessage, void> {
    return this._changed;
  }

  /**
   * Update one or several fields of the message.
   */
  update(updated: Partial<IMessageContent>) {
    this._content = { ...this._content, ...updated };
    this._changed.emit();
  }

  private _content: IMessageContent;
  private _changed = new Signal<IMessage, void>(this);
}
