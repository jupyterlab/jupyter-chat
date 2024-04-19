/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IConfig, chatIcon } from 'chat-jupyter';

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
 * The token for the chat widget config
 */
export const IWidgetConfig = new Token<IWidgetConfig>(
  '@jupyter/collaboration:IChatDocument'
);

/**
 * Chat widget config
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
  openChat: 'collaborative-chat:open'
};
