/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  AbstractChatModel,
  AbstractChatContext,
  IAttachment,
  IChatContext,
  IChatModel,
  IInputModel,
  IMessageContent,
  INewMessage,
  IUser
} from '@jupyter/chat';
import type { IAwareness } from '@jupyter/ydoc';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { ServerConnection, User } from '@jupyterlab/services';
import { PartialJSONObject, UUID } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { enforceAutosaveEnabled } from './autosave';
import { IWidgetConfig } from './token';
import { WebSocketHandler } from './websocket-handler';
import { IChatChanges, IYmessage, YChat } from './ychat';

const WRITING_DELAY = 1000;

/**
 * How long a server-pushed (e.g. AI persona) writing status stays visible
 * without a refresh. The sender is expected to re-broadcast while still
 * writing and to send an explicit stop when done; this is only a safety net so
 * a crashed or forgetful sender cannot leave a "is writing" indicator stuck
 * forever. An explicit stop clears it immediately, regardless of this value.
 */
const WS_WRITING_TIMEOUT = 3000;

/**
 * Coerce an untrusted value to an `IUser`, or `null` if it is not one.
 * Awareness state is written by arbitrary clients, so the only field we rely on
 * is a string `username`.
 */
function asUser(value: unknown): IUser | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { username?: unknown }).username === 'string'
  ) {
    return value as IUser;
  }
  return null;
}

/**
 * Coerce an untrusted value to an `IWriter`, or `null` if it is not one.
 */
function asWriter(value: unknown): IChatModel.IWriter | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const user = asUser(record.user);
  if (!user) {
    return null;
  }
  return {
    user,
    messageID:
      typeof record.messageID === 'string' ? record.messageID : undefined,
    typingIndicator:
      typeof record.typingIndicator === 'string'
        ? record.typingIndicator
        : undefined
  };
}

/**
 * Build the writers list from the raw awareness states of a collaborative chat.
 *
 * Two shapes appear on the shared awareness channel: a peer advertising its own
 * typing on its own slot (`isWriting`), and the set of writers a server-side
 * sender (e.g. AI personas) publishes as a `writers` list on a single slot,
 * since those senders have no awareness client of their own. Duplicate
 * usernames are collapsed downstream by `updateWriters`.
 *
 * Awareness state is untrusted (any client can write anything), so every field
 * is validated before use and malformed entries are dropped. Exported for tests.
 */
export function collectWritersFromAwareness(
  states: Map<number, Record<string, unknown>>,
  localUsername: string
): IChatModel.IWriter[] {
  const writers: IChatModel.IWriter[] = [];
  // The current user must never see themselves as a writer, whichever slot
  // advertises them (their own typing slot, or a server-published set).
  const pushWriter = (writer: IChatModel.IWriter | null): void => {
    if (writer && writer.user.username !== localUsername) {
      writers.push(writer);
    }
  };
  for (const state of states.values()) {
    if (typeof state !== 'object' || state === null) {
      continue;
    }

    // A server-side sender publishes the whole writer set on one slot.
    if (Array.isArray(state.writers)) {
      for (const entry of state.writers) {
        pushWriter(asWriter(entry));
      }
    }

    // A peer advertises its own typing on its own slot. `isWriting` is `true`
    // (writing, no target message) or the string ID of the message being
    // written; anything else is ignored.
    const isWriting = state.isWriting;
    if (isWriting === true || (typeof isWriting === 'string' && isWriting)) {
      const user = asUser(state.user);
      if (user) {
        pushWriter({
          user,
          messageID: typeof isWriting === 'string' ? isWriting : undefined,
          typingIndicator:
            typeof state.typingIndicator === 'string'
              ? state.typingIndicator
              : undefined
        });
      }
    }
  }
  return writers;
}

/**
 * Chat model namespace.
 */
export namespace LabChatModel {
  export interface IOptions extends IChatModel.IOptions {
    widgetConfig: IWidgetConfig;
    user: User.IIdentity | null;
    sharedModel?: YChat;
    languagePreference?: string;
    collaborative?: boolean;
    serverSettings?: ServerConnection.ISettings;
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

    this.collaborative = options.collaborative ?? true;

    // initialize current user
    this._user = new LabChatUser(options.user);

    const { widgetConfig } = options;

    this._sharedModel = options.sharedModel ?? YChat.create();

    this._sharedModel.changed.connect(this._onchange, this);

    this.config = widgetConfig.config;

    widgetConfig.configChanged.connect((_, config) => {
      this.config = config;
    });

    this.sharedModel.awareness.on('change', this.onAwarenessChange);
    this.sharedModel.awareness.on('change', this._enforceAutosaveEnabled);
    this._enforceAutosaveEnabled();

    this.input.valueChanged.connect((_, value) => this.onInputChanged(value));
    this.messageEditionAdded.connect(this.onMessageEditionAdded);

    if (!this.collaborative && options.serverSettings) {
      this._wsHandler = new WebSocketHandler({
        serverSettings: options.serverSettings
      });
      this._wsHandler.messageReceived.connect(this._onWsMessage, this);
      this._wsHandler.usersChanged.connect(this._onWsUsersChanged, this);
      this._wsHandler.metadataChanged.connect(this._onWsMetadata, this);
      this._wsHandler.writingChanged.connect(this._onWsWriting, this);
    }
  }

  collaborative: boolean;

  get user(): IUser {
    return this._user;
  }

  get sharedModel(): YChat {
    return this._sharedModel;
  }

  /**
   * The awareness channel of the shared model.
   */
  get awareness(): IAwareness {
    return this._sharedModel.awareness;
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

  // Declaring `set id` in this subclass shadows the base class's accessor
  // property entirely, so `get id` must be redeclared here too or reading
  // `.id` on a LabChatModel returns undefined even after `_id` is set.
  get id(): string | undefined {
    return super.id;
  }
  set id(value: string | undefined) {
    super.id = value;
    if (value) {
      this.setReady(value);
    }
  }

  /**
   * Notify the model that its shared document has been synchronized with the
   * server, and give it an ID if the document does not carry one yet.
   *
   * The model is only ready once it has an ID, so this must be called as soon as
   * the document content is known - the ID cannot be created earlier, or a chat
   * that already has one stored would end up with a conflicting ID.
   *
   * Callers should hook this to `IDocumentProvider.ready` (or the document
   * context's `ready`) rather than to the document becoming clean: since
   * jupyter-collaboration 5 a room stays dirty after being loaded, so the
   * transition out of the dirty state may only happen on the first save, about a
   * second later, leaving the chat unusable until then.
   */
  markDocumentSynced(): void {
    if (this._wsHandler) {
      this._wsHandler.setPath(this.name);
      this._wsHandler.initialize();
      this._wsHandler.ready
        .then(() => {
          // The connection frame carries both the chat id and the identity the
          // server registered for this connection. The chat is not ready until
          // both are known: the client adopts the server-assigned identity (the
          // RTC-free server owns identity) and takes the server's chat id.
          const wsUser = this._wsHandler!.connectedUser;
          const serverId = this._wsHandler!.chatId;
          if (!wsUser || !serverId) {
            console.error(
              'WS chat connection frame did not include the user identity ' +
                'and chat id; the chat cannot become ready. Is the server up ' +
                'to date?'
            );
            return;
          }
          this._user = new LabChatUser(wsUser);
          if (!this.id) {
            this.id = serverId;
          }
        })
        .catch(e => {
          console.warn(
            'WS chat connection failed, falling back to shared model',
            e
          );
          this._wsHandler?.dispose();
          this._wsHandler = null;
          if (!this._sharedModel.id) {
            this._sharedModel.id = UUID.uuid4();
          }
        });
      return;
    }
    // The synced document's `id` metadata is the single source of truth for the
    // chat id under RTC: the server writes it (the same value `chat.get_id()`
    // returns) and it reaches us through the shared document. When it is already
    // present at sync time, adopt it and resolve `ready` with it - the initial
    // sync populates it without emitting an `_onchange` metadata delta, so
    // nothing else would set the model id and `ready` would never resolve.
    if (this._sharedModel.id) {
      this.id = this._sharedModel.id;
    } else {
      // Brand-new document with no id yet: assigning the shared id emits a
      // metadata change that sets the model id - and therefore resolves `ready`
      // - through `_onchange`. A server-authored id that arrives later is
      // likewise adopted through `_onchange`. We do NOT mint an id that would
      // diverge from the server's, since the server reads back this value.
      this._sharedModel.id = UUID.uuid4();
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._wsHandler?.dispose();
    this._wsHandler = null;
    super.dispose();
    this.sharedModel.awareness.off('change', this.onAwarenessChange);
    this.sharedModel.awareness.off('change', this._enforceAutosaveEnabled);
    this._sharedModel.dispose();
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
    messages: IMessageContent[]
  ): Promise<void> {
    // Ensure the chat has an ID before inserting the messages, to properly catch the
    // unread messages (the last read message is saved using the chat ID).
    return this.ready.then(() => {
      super.messagesInserted(index, messages);
    });
  }

  sendMessage(message: INewMessage): string | null {
    // Allow empty message for bot only, as it may be streamed later.
    if (
      !message.body &&
      !message.mime_model &&
      !message.attachments?.length &&
      !message.sender?.bot
    ) {
      return null;
    }
    this.broadcastWritingStatus(null);
    if (this._timeoutWriting !== null) {
      window.clearTimeout(this._timeoutWriting);
      this._timeoutWriting = null;
    }

    if (this._wsHandler) {
      return this._wsHandler.sendMessage(message);
    }

    const content: IMessageContent = {
      ...message,
      type: 'msg',
      id: UUID.uuid4(),
      body: message.body ?? '',
      time: Date.now() / 1000,
      sender: message.sender ?? this._user,
      // Set the raw time only if there is a server to update the time to a reference
      // one (the server time is source of truth). At that stage, without collaboration,
      // this means that the chat is running without server (jupyterlite).
      raw_time: this.collaborative ? true : false
    };

    this.sharedModel.addMessage(this._contentToYmessage(content));
    return content.id;
  }

  /**
   * Override the clear messages method.
   */
  clearMessages(): void {
    // No-op as we may not need to clear the messages in file based chat.
  }

  updateMessage(
    id: string,
    updatedMessage: IMessageContent
  ): Promise<boolean | void> | boolean | void {
    if (this._wsHandler) {
      this._wsHandler.updateMessage(id, updatedMessage);
      return;
    }

    const index = this.sharedModel.getMessageIndex(id);
    this.sharedModel.updateMessage(
      index,
      this._contentToYmessage({
        ...updatedMessage,
        id,
        edited: updatedMessage.sender.bot ? updatedMessage.edited : true
      })
    );
  }

  deleteMessage(id: string): Promise<boolean | void> | boolean | void {
    if (this._wsHandler) {
      this._wsHandler.deleteMessage(id);
      return;
    }

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
    if (!this.config.sendTypingNotification) {
      return;
    }
    if (this._timeoutWriting !== null) {
      window.clearTimeout(this._timeoutWriting);
      this._timeoutWriting = null;
    }
    // Empty input (including right after sending) means the user stopped.
    if (!value) {
      this.broadcastWritingStatus(null);
      return;
    }
    this.broadcastWritingStatus({ messageID });
    this._timeoutWriting = window.setTimeout(() => {
      this._timeoutWriting = null;
      this.broadcastWritingStatus(null);
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
   * Used to populate the writers list from the shared awareness channel.
   */
  onAwarenessChange = () => {
    this.updateWriters(
      collectWritersFromAwareness(
        this.sharedModel.awareness.getStates(),
        this.user.username
      )
    );
  };

  /**
   * Broadcast the current user's writing status.
   *
   * Collaborative (RTC) mode advertises it over the awareness channel so peers
   * see it. RTC-free (WebSocket) mode is effectively single-user, so the client
   * does not advertise its own typing at all -- writers only ever come from the
   * server (e.g. AI agents). Hence this is a no-op without RTC.
   */
  broadcastWritingStatus(status: IChatModel.IWritingStatus | null): void {
    if (!this.collaborative) {
      return;
    }
    const awareness = this.sharedModel.awareness;
    if (status === null) {
      const local = awareness.getLocalState() ?? {};
      delete local.isWriting;
      delete local.typingIndicator;
      awareness.setLocalState(local);
    } else {
      awareness.setLocalStateField('isWriting', status.messageID ?? true);
      awareness.setLocalStateField(
        'typingIndicator',
        status.typingIndicator ?? null
      );
    }
  }

  /**
   * Handle a writing status pushed by the server (e.g. an AI agent) over the
   * WebSocket. The sender controls its own lifecycle via explicit start/stop.
   */
  private _onWsWriting = (
    _: WebSocketHandler,
    writing: WebSocketHandler.IWriting
  ): void => {
    if (writing.user.username === this.user.username) {
      return;
    }
    if (writing.state) {
      this.setWritingStatus(
        writing.user,
        {
          messageID: writing.messageID,
          typingIndicator: writing.typingIndicator
        },
        WS_WRITING_TIMEOUT
      );
    } else {
      this.clearWritingStatus(writing.user);
    }
  };

  private _enforceAutosaveEnabled = () => {
    enforceAutosaveEnabled(this.sharedModel.awareness);
  };

  private _onchange = async (_: YChat, changes: IChatChanges) => {
    if (changes.messageListChanges) {
      const msgDelta = changes.messageListChanges;
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
            } = ymessage.toJSON() as IYmessage;

            // Build the base message with sender.
            const msg: IMessageContent = {
              ...baseMessage,
              sender: this.sharedModel.getUser(sender) || {
                username: this._trans.__('User undefined'),
                mention_name: this._trans.__('User-undefined')
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
                  username: this._trans.__('User undefined'),
                  mention_name: this._trans.__('User-undefined')
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

    if (changes.messageChanges) {
      // Update change in the message.
      changes.messageChanges.forEach(change => {
        const message = this.messages[change.index];
        if (change.type === 'remove') {
          delete message[change.key as keyof IMessageContent];
        } else if (change.newValue !== undefined) {
          const key = change.key;
          const value = change.newValue;
          if (key === 'attachments') {
            const attachments: IAttachment[] = [];
            (value as string[]).forEach(attachmentId => {
              const attachment = this.sharedModel.getAttachment(attachmentId);
              if (attachment) {
                attachments.push(attachment);
              }
            });
            if (attachments.length) {
              message.update({ attachments });
            } else {
              message.update({ attachments: undefined });
            }
          } else if (key === 'mentions') {
            const mentions: IUser[] = (value as string[]).map(
              user =>
                this.sharedModel.getUser(user) || {
                  username: this._trans.__('User undefined'),
                  mention_name: this._trans.__('User-undefined')
                }
            );
            if (mentions?.length) {
              message.update({ mentions });
            }
          } else if (
            [
              'body',
              'time',
              'raw_time',
              'deleted',
              'edited',
              'metadata',
              'mime_model'
            ].includes(key)
          ) {
            const update: Partial<IMessageContent> = {};
            update[key as keyof IMessageContent] = value;
            message.update(update);
          } else {
            console.error(
              `The attribute '${key}' of message cannot be updated`
            );
          }
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

    if (changes.userChanges) {
      // Update the current user if it changes (if it has been mentioned for example).
      changes.userChanges.forEach(change => {
        if (change.key === this._user.username && change.newValue) {
          this._user = change.newValue;
        }
      });
    }

    // Create a chat ID if not created when the document is not dirty.
    //
    // This is a fallback for chats whose document is not backed by a
    // collaborative provider, and so never reports being synchronized. When
    // there is one, `markDocumentSynced()` gets there first.
    // Not needed in WS mode — readiness is signalled by the connection message.
    if (changes.stateChange && !this._sharedModel.id && !this._wsHandler) {
      if (
        changes.stateChange.some(
          change => change.name === 'dirty' && !change.newValue
        )
      ) {
        this._sharedModel.id = UUID.uuid4();
      }
    }
  };

  private _onWsUsersChanged = (
    _: WebSocketHandler,
    users: Record<string, IUser>
  ): void => {
    for (const user of Object.values(users)) {
      if (!this._sharedModel.getUser(user.username)) {
        this._sharedModel.setUser(new LabChatUser(user));
      }
    }
  };

  private _onWsMetadata = (
    _: WebSocketHandler,
    metadata: Record<string, any>
  ): void => {
    for (const [key, value] of Object.entries(metadata)) {
      this._sharedModel.setMetadata(key, value);
    }
  };

  private _onWsMessage = (_: WebSocketHandler, msg: IMessageContent): void => {
    const ymsg = this._contentToYmessage(msg);
    const index = this._sharedModel.getMessageIndex(ymsg.id);
    if (index >= 0) {
      this._sharedModel.updateMessage(index, ymsg);
    } else {
      this._sharedModel.addMessage(ymsg);
    }
  };

  private _contentToYmessage(msg: IMessageContent): IYmessage {
    const sender = msg.sender as IUser;
    if (!this._sharedModel.getUser(sender.username)) {
      this._sharedModel.setUser(new LabChatUser(sender));
    }
    const ymsg: IYmessage = {
      type: msg.type ?? 'msg',
      id: msg.id,
      body: msg.body,
      time: msg.time,
      sender: sender.username
    };
    if (msg.raw_time !== undefined) {
      ymsg.raw_time = msg.raw_time;
    }
    if (msg.edited) {
      ymsg.edited = msg.edited;
    }
    if (msg.deleted) {
      ymsg.deleted = msg.deleted;
    }
    if (msg.metadata) {
      ymsg.metadata = msg.metadata;
    }
    if (msg.mime_model) {
      ymsg.mime_model = msg.mime_model;
    }
    if (msg.attachments?.length) {
      ymsg.attachments = msg.attachments.map(att =>
        this._sharedModel.setAttachment(att)
      );
    }
    if (msg.mentions?.length) {
      const mentionUsernames: string[] = [];
      for (const u of msg.mentions) {
        if (u.mention_name) {
          if (!new RegExp('@' + u.mention_name).exec(msg.body)) {
            continue;
          }
        }
        if (!this._sharedModel.getUser(u.username)) {
          this._sharedModel.setUser(new LabChatUser(u));
        }
        mentionUsernames.push(u.username);
      }
      if (mentionUsernames.length) {
        ymsg.mentions = mentionUsernames;
      }
    }
    return ymsg;
  }

  readonly defaultKernelName: string = '';
  readonly defaultKernelLanguage: string = '';

  private _sharedModel: YChat;

  private _dirty = false;
  private _readOnly = false;
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _timeoutWriting: number | null = null;

  private _user: IUser;
  private _wsHandler: WebSocketHandler | null = null;
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
