/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  AbstractChatModel,
  AbstractChatContext,
  IAttachment,
  IChatContext,
  IChatMessage,
  IChatModel,
  IInputModel,
  INewMessage,
  IUser
} from '@jupyter/chat';
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
  export interface IOptions extends IChatModel.IOptions {
    widgetConfig: IWidgetConfig;
    user: User.IIdentity | null;
    sharedModel?: YChat;
    languagePreference?: string;
  }
}

/**
 * A data model class that represents a user and implements the `IUser` interface.
 * Currently, this just just ensures that `user.mention_name` is always
 * accessible by defining it as a getter property.
 *
 * The constructor accepts an `identity: User.IIdentity | IUser | null` object.
 * If `identity == null`, this class provides default values for each required
 * field.
 *
 * TODO: should `identity` (from `LabChatModel.IOptions.user`) ever be `null`?
 *
 * TODO: should this be lifted up into `packages/jupyter-chat`?
 */
class LabChatUser implements IUser {
  constructor(identity: User.IIdentity | IUser | null) {
    this.username = identity?.username ?? 'user undefined';
    this.name = identity?.name;
    this.display_name = identity?.display_name;
    this.color = identity?.color;
    this.avatar_url = identity?.avatar_url;
    this.initials = identity?.initials;
    this.bot = !!identity?.bot || false;
  }

  get mention_name(): string {
    let mention_name = this.display_name || this.name || this.username;
    mention_name = mention_name.replace(/ /g, '-');
    return mention_name;
  }

  toJSON() {
    const simpleObject = {
      ...this,
      mention_name: this.mention_name
    };
    return simpleObject;
  }

  username: string;
  name?: string;
  display_name?: string;
  initials?: string;
  color?: string;
  avatar_url?: string;
  bot?: boolean;
}

/**
 * The chat document model.
 */
export class LabChatModel
  extends AbstractChatModel
  implements DocumentRegistry.IModel
{
  constructor(options: LabChatModel.IOptions) {
    super(options);

    // initialize current user
    this._user = new LabChatUser(options.user);

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

    this.input.valueChanged.connect((_, value) => this.onInputChanged(value));
    this.messageEditionAdded.connect(this.onMessageEditionAdded);
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

  get ready(): Promise<void> {
    return this._ready.promise;
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

  createChatContext(): IChatContext {
    return new LabChatContext({ model: this });
  }

  async messagesInserted(
    index: number,
    messages: IChatMessage[]
  ): Promise<void> {
    // Ensure the chat has an ID before inserting the messages, to properly catch the
    // unread messages (the last read message is saved using the chat ID).
    return this._ready.promise.then(() => {
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

    // Add the attachments to the message.
    const attachmentIds = this.input.attachments?.map(attachment =>
      this.sharedModel.setAttachment(attachment)
    );
    if (attachmentIds?.length) {
      msg.attachments = attachmentIds;
    }
    this.input.clearAttachments();

    // Add the mentioned users.
    const mentions = this._buildMentionList(this.input.mentions, message.body);
    if (mentions.length) {
      msg.mentions = mentions;
    }
    this.input.clearMentions();

    this.sharedModel.addMessage(msg);
  }

  /**
   * Override the clear messages method.
   */
  clearMessages(): void {
    // No-op as we may not need to clear the messages in file based chat.
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

    // Update the attachments.
    const attachmentIds = updatedMessage.attachments?.map(attachment =>
      this.sharedModel.setAttachment(attachment)
    );
    if (attachmentIds?.length) {
      message.attachments = attachmentIds;
    } else {
      delete message.attachments;
    }

    // Update the mentioned users.
    const mentions = this._buildMentionList(
      updatedMessage.mentions,
      updatedMessage.body
    );
    if (mentions.length) {
      message.mentions = mentions;
    } else {
      delete message.mentions;
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
   * Function called when the input content changed.
   *
   * @param value - The whole input content.
   * @param messageID - The ID of the message being edited, if any.
   */
  onInputChanged = (value: string, messageID?: string): void => {
    if (!value || !this.config.sendTypingNotification) {
      return;
    }
    const awareness = this.sharedModel.awareness;
    if (this._timeoutWriting !== null) {
      window.clearTimeout(this._timeoutWriting);
    }
    awareness.setLocalStateField('isWriting', messageID ?? true);
    this._timeoutWriting = window.setTimeout(() => {
      this._resetWritingStatus();
    }, WRITING_DELAY);
  };

  /**
   * Listen to the message edition input.
   */
  onMessageEditionAdded = (
    _: IChatModel,
    edition: IChatModel.IMessageEdition
  ) => {
    if (edition !== null) {
      const _onInputChanged = (_: IInputModel, value: string) => {
        this.onInputChanged(value, edition.id);
      };

      edition.model.valueChanged.connect(_onInputChanged);
    }
  };

  /**
   * Triggered when an awareness state changes.
   * Used to populate the writers list.
   */
  onAwarenessChange = () => {
    const writers: IChatModel.IWriter[] = [];
    const states = this.sharedModel.awareness.getStates();
    for (const stateID of states.keys()) {
      const state = states.get(stateID);
      if (!state || !state.user || state.user.username === this.user.username) {
        continue;
      }
      if (state.isWriting !== undefined && state.isWriting !== false) {
        const writer: IChatModel.IWriter = {
          user: state.user,
          messageID: state.isWriting === true ? undefined : state.isWriting
        };
        writers.push(writer);
      }
    }
    this.updateWriters(writers);
  };

  private _buildMentionList(
    userMentions: IUser[] | undefined,
    body: string
  ): string[] {
    if (!userMentions) {
      return [];
    }
    const mentions: string[] = [];
    userMentions.forEach(user => {
      // Make sure the user is still mentioned.
      if (!user.mention_name) {
        return;
      }
      const mention = '@' + user.mention_name;
      const regex = new RegExp(mention);
      if (!regex.exec(body)) {
        return;
      }

      // Save the mention name if necessary.
      if (!(this.sharedModel.getUser(user.username) === user)) {
        this.sharedModel.setUser(user);
      }
      mentions.push(user.username);
    });
    return mentions;
  }

  private _resetWritingStatus() {
    const awareness = this.sharedModel.awareness;
    const states = awareness.getLocalState();
    delete states?.isWriting;
    awareness.setLocalState(states);
    this._timeoutWriting = null;
  }

  private _onchange = async (_: YChat, changes: IChatChanges) => {
    if (changes.messageChanges) {
      const msgDelta = changes.messageChanges;
      let index = 0;
      for (const delta of msgDelta) {
        if (delta.retain) {
          index += delta.retain;
        } else if (delta.insert) {
          const messages = delta.insert.map(ymessage => {
            const {
              sender,
              attachments: attachmentIds,
              mentions: mentionsIds,
              ...baseMessage
            } = ymessage;

            // Build the base message with sender.
            const msg: IChatMessage = {
              ...baseMessage,
              sender: this.sharedModel.getUser(sender) || {
                username: 'User undefined',
                mention_name: 'User-undefined'
              }
            };

            // Add attachments.
            if (attachmentIds) {
              const attachments: IAttachment[] = [];
              attachmentIds.forEach(attachmentId => {
                const attachment = this.sharedModel.getAttachment(attachmentId);
                if (attachment) {
                  attachments.push(attachment);
                }
              });
              if (attachments.length) {
                msg.attachments = attachments;
              }
            }

            const mentions: IUser[] = (mentionsIds ?? []).map(
              user =>
                this.sharedModel.getUser(user) || {
                  username: 'User undefined',
                  mention_name: 'User-undefined'
                }
            );

            if (mentions?.length) {
              msg.mentions = mentions;
            }
            return msg;
          });
          await this.messagesInserted(index, messages);
          index += messages.length;
        } else if (delta.delete) {
          this.messagesDeleted(index, delta.delete);
        }
      }
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

    if (changes.userChanges) {
      // Update the current user if it changes (if it has been mentioned for example).
      changes.userChanges.forEach(change => {
        if (change.key === this._user.username && change.newValue) {
          this._user = change.newValue;
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

/**
 * The chat context to be sent to the input model.
 */
export class LabChatContext extends AbstractChatContext {
  /**
   * The list of users who have connected to this chat.
   */
  get users(): LabChatUser[] {
    const model = this._model as LabChatModel;
    const users: Record<string, LabChatUser> = {};

    // Add existing users from the YChat
    // This only includes users who have sent a message in the chat.
    for (const user of Object.values(model.sharedModel.users)) {
      users[user.username] = new LabChatUser(user);
    }

    // Add users from awareness to include connected users even if they never
    // sent a message in the chat.
    model.sharedModel.awareness.getStates().forEach(value => {
      if (!('user' in value)) {
        return;
      }
      const userObject = value.user as IUser;
      if (userObject?.username in users) {
        return;
      }
      const user = new LabChatUser(value.user as IUser);
      users[user.username] = user;
    });

    return Array.from(Object.values(users));
  }
}
