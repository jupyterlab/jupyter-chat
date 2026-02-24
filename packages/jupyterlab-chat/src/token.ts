/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IConfig,
  chatIcon,
  IActiveCellManager,
  ISelectionWatcher
} from '@jupyter/chat';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';
import { MultiChatPanel } from '@jupyter/chat';
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
   * Move a main widget to the side panel.
   */
  moveToSide: 'jupyterlab-chat:moveToSide',
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
   * Export the current chat as a Markdown file.
   */
  exportChat: 'jupyterlab-chat:exportChat'
};

/**
 * The chat panel token.
 */
export const IChatPanel = new Token<MultiChatPanel>(
  'jupyterlab-chat:IChatPanel'
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
