/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { buildChatSidebar, buildErrorWidget } from '@jupyter/chat';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ReactWidget, IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { WebSocketHandler } from './handlers/websocket-handler';

const pluginId = 'jupyterlab-ws-chat:chat';
/**
 * Initialization of the @jupyterlab/chat extension.
 */
const chat: JupyterFrontEndPlugin<void> = {
  id: pluginId,
  description: 'A chat extension for Jupyterlab',
  autoStart: true,
  optional: [ILayoutRestorer, ISettingRegistry, IThemeManager],
  requires: [IRenderMimeRegistry],
  activate: async (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
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
    Promise.all([app.restored, settingsRegistry?.load(pluginId)])
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
        rmRegistry
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

export default chat;
