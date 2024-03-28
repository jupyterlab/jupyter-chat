/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ReactWidget, IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { buildChatSidebar, buildErrorWidget } from '@jupyter/chat';

import { WebSocketHandler } from './handlers/websocket-handler';

/**
 * Initialization of the @jupyterlab/chat extension.
 */
const chat: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-extension:chat',
  description: 'A chat extension for Jupyterlab',
  autoStart: true,
  optional: [ILayoutRestorer, IThemeManager],
  requires: [IRenderMimeRegistry],
  activate: async (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    restorer: ILayoutRestorer | null,
    themeManager: IThemeManager | null
  ) => {
    /**
     * Initialize chat handler, open WS connection
     */
    const chatHandler = new WebSocketHandler();

    let chatWidget: ReactWidget | null = null;
    try {
      await chatHandler.initialize();
      chatWidget = buildChatSidebar(chatHandler, themeManager, rmRegistry);
    } catch (e) {
      chatWidget = buildErrorWidget(themeManager);
    }

    /**
     * Add Chat widget to right sidebar
     */
    app.shell.add(chatWidget, 'left', { rank: 2000 });

    if (restorer) {
      restorer.add(chatWidget, 'jupyter-chat');
    }
    console.log('Chat extension initialized');
  }
};

export default chat;
