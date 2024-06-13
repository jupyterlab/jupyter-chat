/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
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
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { WebSocketHandler } from './handlers/websocket-handler';

const pluginIds = {
  acRegistry: 'jupyterlab-ws-chat:autocompletionRegistry',
  chat: 'jupyterlab-ws-chat:chat'
};

/**
 * Extension providing the autocompletion registry.
 */
const autocompletionPlugin: JupyterFrontEndPlugin<IAutocompletionRegistry> = {
  id: pluginIds.acRegistry,
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
    ISettingRegistry,
    IThemeManager
  ],
  activate: async (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    autocompletionRegistry: IAutocompletionRegistry,
    restorer: ILayoutRestorer | null,
    settingsRegistry: ISettingRegistry | null,
    themeManager: IThemeManager | null
  ) => {
    /**
     * Initialize chat handler, open WS connection
     */
    const chatHandler = new WebSocketHandler({ commands: app.commands });

    /**
     * Load the settings.
     */
    let sendWithShiftEnter = false;
    let stackMessages = true;
    let unreadNotifications = true;
    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      sendWithShiftEnter = setting.get('sendWithShiftEnter')
        .composite as boolean;
      stackMessages = setting.get('stackMessages').composite as boolean;
      unreadNotifications = setting.get('unreadNotifications')
        .composite as boolean;
      chatHandler.config = {
        sendWithShiftEnter,
        stackMessages,
        unreadNotifications
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
