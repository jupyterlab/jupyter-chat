/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ActiveCellManager,
  AutocompletionRegistry,
  IAutocompletionRegistry,
  buildChatSidebar,
  buildErrorWidget
} from '@jupyter/chat';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ReactWidget, IThemeManager } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { WebSocketHandler } from './handlers/websocket-handler';

const pluginIds = {
  autocompletionRegistry: 'jupyterlab-ws-chat-extension:autocompletionRegistry',
  chat: 'jupyterlab-ws-chat-extension:chat'
};

/**
 * Extension providing the autocompletion registry.
 */
const autocompletionPlugin: JupyterFrontEndPlugin<IAutocompletionRegistry> = {
  id: pluginIds.autocompletionRegistry,
  description: 'An autocompletion registry',
  autoStart: true,
  provides: IAutocompletionRegistry,
  activate: (app: JupyterFrontEnd): IAutocompletionRegistry => {
    return new AutocompletionRegistry();
  }
};

/**
 * Initialization of the @jupyterlab/chat extension.
 */
const chat: JupyterFrontEndPlugin<void> = {
  id: pluginIds.chat,
  description: 'A chat extension for Jupyterlab',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [
    IAutocompletionRegistry,
    ILayoutRestorer,
    INotebookTracker,
    ISettingRegistry,
    IThemeManager
  ],
  activate: async (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    autocompletionRegistry: IAutocompletionRegistry,
    restorer: ILayoutRestorer | null,
    notebookTracker: INotebookTracker,
    settingsRegistry: ISettingRegistry | null,
    themeManager: IThemeManager | null
  ) => {
    // Create an active cell manager for code toolbar.
    const activeCellManager = new ActiveCellManager({
      tracker: notebookTracker,
      shell: app.shell
    });

    /**
     * Initialize chat handler, open WS connection
     */
    const chatHandler = new WebSocketHandler({
      commands: app.commands,
      activeCellManager
    });

    /**
     * Load the settings.
     */
    let sendWithShiftEnter = false;
    let stackMessages = true;
    let unreadNotifications = true;
    let enableCodeToolbar = true;
    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      sendWithShiftEnter = setting.get('sendWithShiftEnter')
        .composite as boolean;
      stackMessages = setting.get('stackMessages').composite as boolean;
      unreadNotifications = setting.get('unreadNotifications')
        .composite as boolean;
      enableCodeToolbar = setting.get('enableCodeToolbar').composite as boolean;
      chatHandler.config = {
        sendWithShiftEnter,
        stackMessages,
        unreadNotifications,
        enableCodeToolbar
      };
    }

    // Wait for the application to be restored and
    // for the settings to be loaded
    Promise.all([app.restored, settingsRegistry?.load(pluginIds.chat)])
      .then(([, settings]) => {
        if (!settings) {
          console.warn(
            'The SettingsRegistry is not loaded for the chat extension'
          );
          return;
        }

        // Read the settings
        loadSetting(settings);

        // Listen for the plugin setting changes
        settings.changed.connect(loadSetting);
      })
      .catch(reason => {
        console.error(
          `Something went wrong when reading the settings.\n${reason}`
        );
      });

    let chatWidget: ReactWidget | null = null;
    try {
      await chatHandler.initialize();
      chatWidget = buildChatSidebar({
        model: chatHandler,
        themeManager,
        rmRegistry,
        autocompletionRegistry
      });
    } catch (e) {
      chatWidget = buildErrorWidget(themeManager);
    }

    /**
     * Add Chat widget to left sidebar
     */
    app.shell.add(chatWidget as ReactWidget, 'left', { rank: 2000 });

    if (restorer) {
      restorer.add(chatWidget as ReactWidget, 'jupyter-chat');
    }

    console.log('Chat extension initialized');
  }
};

export default [autocompletionPlugin, chat];
