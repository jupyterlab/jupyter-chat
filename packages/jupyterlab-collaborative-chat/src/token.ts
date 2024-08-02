/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IConfig, chatIcon } from '@jupyter/chat';
import { IWidgetTracker } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';
import { ChatPanel, CollaborativeChatPanel } from './widget';

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
export const IChatFactory = new Token<IChatFactory>(
  'jupyter-collaborative-chat:IChatFactory'
);

/**
 * The interface for the chat factory objects.
 */
export interface IChatFactory {
  /**
   * The chat widget config.
   */
  widgetConfig: IWidgetConfig;
  /**
   * The chat panel tracker.
   */
  tracker: IWidgetTracker<CollaborativeChatPanel>;
}

/**
 * The interface for the chats config.
 */
export interface IWidgetConfig {
  /**
   * The widget config
   */
  config: Partial<IConfig>;

  /**
   * A signal emitting when the configuration for the chats has changed.
   */
  configChanged: IConfigChanged;
}

/**
 * A signal emitting when the configuration for the chats has changed.
 */
export interface IConfigChanged
  extends ISignal<IWidgetConfig, Partial<IConfig>> {}

/**
 * Command ids.
 */
export const CommandIDs = {
  /**
   * Create a chat file.
   */
  createChat: 'collaborative-chat:create',
  /**
   * Open a chat file.
   */
  openChat: 'collaborative-chat:open',
  /**
   * Move a main widget to the side panel
   */
  moveToSide: 'collaborative-chat:moveToSide',
  /**
   * Mark as read.
   */
  markAsRead: 'collaborative-chat:markAsRead'
};

/**
 * The chat panel token.
 */
export const IChatPanel = new Token<ChatPanel>(
  'jupyter-collaborative-chat:IChatPanel'
);

/**
 * The active cell manager plugin.
 */
export const IActiveCellManagerToken = new Token<ChatPanel>(
  'jupyter-collaborative-chat:IActiveCellManager'
);
