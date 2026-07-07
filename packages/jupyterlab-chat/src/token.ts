/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IConfig,
  IActiveCellManager,
  IChatPanel,
  ISelectionWatcher,
  MultiChatPanel,
  chatIcon
} from '@jupyter/chat';
import { ToolbarRegistry } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IObservableList } from '@jupyterlab/observables';
import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';
import { ChatWidgetFactory } from './factory';

/**
 * The file type for a chat document.
 */
export const chatFileType: DocumentRegistry.IFileType = {
  name: 'chat',
  displayName: 'Chat',
  mimeTypes: ['text/json', 'application/json'],
  extensions: ['.chat'],
  fileFormat: 'text',
  contentType: 'chat',
  icon: chatIcon
};

/**
 * The token for the chat widget factory.
 */
export const IChatFactory = new Token<ChatWidgetFactory>(
  'jupyterlab-chat:IChatFactory'
);

/**
 * The type for the chat toolbar factory.
 * Given a chat panel, returns an observable list of toolbar items.
 */
export type ChatToolbarFactory = (
  panel: IChatPanel
) => IObservableList<ToolbarRegistry.IToolbarItem>;

/**
 * The token providing the chat toolbar factory, shared by the main area
 * and side panel so that toolbar items are registered only once.
 */
export const IChatToolbarFactory = new Token<ChatToolbarFactory>(
  'jupyterlab-chat:IChatToolbarFactory'
);

/**
 * The chat configs.
 */
export interface ILabChatConfig extends IConfig {
  /**
   * The default directory where to create and look for chat.
   */
  defaultDirectory?: string;
}

/**
 * The interface for the chats config.
 */
export interface IWidgetConfig {
  /**
   * The widget config
   */
  config: Partial<ILabChatConfig>;

  /**
   * A signal emitting when the configuration for the chats has changed.
   */
  configChanged: IConfigChanged;
}

/**
 * The token providing the chat widget config.
 */
export const IWidgetConfig = new Token<IWidgetConfig>(
  'jupyterlab-chat:IWidgetConfig'
);

/**
 * A signal emitting when the configuration for the chats has changed.
 */
export interface IConfigChanged /* eslint-disable-line @typescript-eslint/no-empty-object-type */
  extends ISignal<IWidgetConfig, Partial<ILabChatConfig>> {}

/**
 * Command ids.
 */
export const CommandIDs = {
  /**
   * Create a chat file.
   */
  createChat: 'jupyterlab-chat:create',
  /**
   * Open a chat file.
   */
  openChat: 'jupyterlab-chat:open',
  /**
   * Create and open.
   */
  createAndOpen: 'jupyterlab-chat:createAndOpen',
  /**
   * Move a chat between main area and side panel.
   */
  moveChat: 'jupyterlab-chat:moveChat',
  /**
   * Mark as read.
   */
  markAsRead: 'jupyterlab-chat:markAsRead',
  /**
   * Focus the input of the current chat.
   */
  focusInput: 'jupyterlab-chat:focusInput',
  /**
   * Rename the current chat.
   */
  renameChat: 'jupyterlab-chat:renameChat',
  /**
   * Open a chat and send a message into it.
   */
  openWithMessage: 'jupyterlab-chat:openWithMessage'
};

/**
 * The multi-chat panel token.
 */
export const IMultiChatPanel = new Token<MultiChatPanel>(
  'jupyterlab-chat:IMultiChatPanel'
);

/**
 * The active cell manager plugin.
 */
export const IActiveCellManagerToken = new Token<IActiveCellManager>(
  'jupyterlab-chat:IActiveCellManager'
);

/**
 * The selection watcher plugin.
 */
export const ISelectionWatcherToken = new Token<ISelectionWatcher>(
  'jupyterlab-chat:ISelectionWatcher'
);

/**
 * The token to add a welcome message to the chat.
 * This token is not provided by default, but can be provided by third party extensions
 * willing to add a welcome message to the chat.
 */
export const IWelcomeMessage = new Token<string>(
  'jupyterlab-chat:IWelcomeMessage'
);
