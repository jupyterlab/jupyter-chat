/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IGlobalAwareness } from '@jupyter/collaboration';
import { ICollaborativeDrive } from '@jupyter/docprovider';
import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  ICommandPalette,
  IThemeManager,
  IToolbarWidgetRegistry,
  InputDialog,
  WidgetTracker,
  createToolbarFactory,
  showErrorMessage
} from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IObservableList } from '@jupyterlab/observables';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { chatIcon } from 'chat-jupyter';
import { Awareness } from 'y-protocols/awareness';

import {
  WidgetConfig,
  ChatWidgetFactory,
  CollaborativeChatModelFactory
} from './factory';
import { chatFileType, CommandIDs, IWidgetConfig } from './token';
import { CollaborativeChatWidget } from './widget';
import { YChat } from './ychat';

const FACTORY = 'Chat';

const pluginIds = {
  chatCommands: 'jupyterlab-collaborative-chat:commands',
  chatDocument: 'jupyterlab-collaborative-chat:chat-document'
};

/**
 * Extension registering the chat file type.
 */
export const chatDocument: JupyterFrontEndPlugin<IWidgetConfig> = {
  id: pluginIds.chatDocument,
  description: 'A document registration for collaborative chat',
  autoStart: true,
  requires: [IGlobalAwareness, IRenderMimeRegistry],
  optional: [
    ICollaborativeDrive,
    ILayoutRestorer,
    ISettingRegistry,
    IThemeManager,
    IToolbarWidgetRegistry,
    ITranslator
  ],
  provides: IWidgetConfig,
  activate: (
    app: JupyterFrontEnd,
    awareness: Awareness,
    rmRegistry: IRenderMimeRegistry,
    drive: ICollaborativeDrive | null,
    restorer: ILayoutRestorer | null,
    settingRegistry: ISettingRegistry | null,
    themeManager: IThemeManager | null,
    toolbarRegistry: IToolbarWidgetRegistry | null,
    translator_: ITranslator | null
  ): IWidgetConfig => {
    const translator = translator_ ?? nullTranslator;

    // Declare the toolbar factory.
    let toolbarFactory:
      | ((
          widget: CollaborativeChatWidget
        ) =>
          | DocumentRegistry.IToolbarItem[]
          | IObservableList<DocumentRegistry.IToolbarItem>)
      | undefined;
    /**
     * Load the settings for the chat widgets.
     */
    let sendWithShiftEnter = false;

    /**
     * The ChatDocument object.
     */
    const widgetConfig = new WidgetConfig({ sendWithShiftEnter });

    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      sendWithShiftEnter = setting.get('sendWithShiftEnter')
        .composite as boolean;
      widgetConfig.configChanged.emit({ sendWithShiftEnter });
    }

    if (settingRegistry) {
      if (toolbarRegistry) {
        toolbarFactory = createToolbarFactory(
          toolbarRegistry,
          settingRegistry,
          FACTORY,
          pluginIds.chatDocument,
          translator
        );
        console.log('Create toolbarFactory', toolbarFactory);
      }
      // Wait for the application to be restored and
      // for the settings to be loaded
      Promise.all([app.restored, settingRegistry.load(pluginIds.chatDocument)])
        .then(([, setting]) => {
          // Read the settings
          loadSetting(setting);

          // Listen for the plugin setting changes
          setting.changed.connect(loadSetting);
        })
        .catch(reason => {
          console.error(
            `Something went wrong when reading the settings.\n${reason}`
          );
        });
    }

    // Namespace for the tracker
    const namespace = 'chat';

    // Creating the tracker for the document
    const tracker = new WidgetTracker<CollaborativeChatWidget>({ namespace });

    app.docRegistry.addFileType(chatFileType);

    if (drive) {
      const chatFactory = () => {
        return YChat.create();
      };
      drive.sharedModelFactory.registerDocumentFactory('chat', chatFactory);
    }

    // Creating and registering the model factory for our custom DocumentModel
    const modelFactory = new CollaborativeChatModelFactory({
      awareness,
      widgetConfig
    });
    app.docRegistry.addModelFactory(modelFactory);

    // Creating the widget factory to register it so the document manager knows about
    // our new DocumentWidget
    const widgetFactory = new ChatWidgetFactory({
      name: FACTORY,
      label: 'Chat',
      modelName: 'chat',
      fileTypes: ['chat'],
      defaultFor: ['chat'],
      themeManager,
      rmRegistry,
      toolbarFactory,
      translator
    });

    // Add the widget to the tracker when it's created
    widgetFactory.widgetCreated.connect((sender, widget) => {
      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        tracker.save(widget);
      });
      tracker.add(widget);
    });

    // Registering the widget factory
    app.docRegistry.addWidgetFactory(widgetFactory);

    // Handle state restoration.
    if (restorer) {
      void restorer.restore(tracker, {
        command: 'docmanager:open',
        args: panel => ({ path: panel.context.path, factory: FACTORY }),
        name: panel => panel.context.path,
        when: app.serviceManager.ready
      });
    }

    return widgetConfig;
  }
};

/**
 * Extension registering the chat file type.
 */
export const chatCommands: JupyterFrontEndPlugin<void> = {
  id: pluginIds.chatCommands,
  description: 'The commands to create or open a chat',
  autoStart: true,
  requires: [ICollaborativeDrive],
  optional: [ICommandPalette, ILauncher],
  activate: (
    app: JupyterFrontEnd,
    drive: ICollaborativeDrive,
    commandPalette: ICommandPalette | null,
    launcher: ILauncher | null
  ) => {
    const { commands } = app;

    /**
     * Command to create a new chat.
     *
     * args:
     *  name: the name of the chat to create.
     */
    commands.addCommand(CommandIDs.createChat, {
      label: args => (args.isPalette ? 'Create a new chat' : 'Chat'),
      caption: 'Create a chat',
      icon: args => (args.isPalette ? undefined : chatIcon),
      execute: async args => {
        let name: string | null = (args.name as string) ?? null;
        let filepath = '';
        if (!name) {
          name = (
            await InputDialog.getText({
              label: 'Name',
              placeholder: 'untitled',
              title: 'Create a new chat'
            })
          ).value;
        }
        // no-op if the dialog has been cancelled.
        // Fill the filepath if the dialog has been validated with content,
        // otherwise create a new untitled chat (empty filepath).
        if (name === null) {
          return;
        } else if (name) {
          if (name.endsWith(chatFileType.extensions[0])) {
            filepath = name;
          } else {
            filepath = `${name}${chatFileType.extensions[0]}`;
          }
        }

        let fileExist = true;
        if (filepath) {
          await drive.get(filepath, { content: false }).catch(() => {
            fileExist = false;
          });
        } else {
          fileExist = false;
        }

        // Create a new file if it does not exists
        if (!fileExist) {
          // Create a new untitled chat.
          let model: Contents.IModel | null = await drive.newUntitled({
            type: 'file',
            ext: chatFileType.extensions[0]
          });
          // Rename it if a name has been provided.
          if (filepath) {
            model = await drive.rename(model.path, filepath);
          }

          if (!model) {
            showErrorMessage(
              'Error creating a chat',
              'An error occured while creating the chat'
            );
            return '';
          }
          filepath = model.path;
        }

        return commands.execute(CommandIDs.openChat, { filepath });
      }
    });

    /**
     * Command to open a chat.
     *
     * args:
     *  filepath - the chat file to open.
     */
    commands.addCommand(CommandIDs.openChat, {
      label: 'Open a chat',
      execute: async args => {
        let filepath: string | null = (args.filepath as string) ?? null;
        if (filepath === null) {
          filepath = (
            await InputDialog.getText({
              label: 'File path',
              placeholder: '/path/to/the/chat/file',
              title: 'Path of the chat'
            })
          ).value;
        }

        if (!filepath) {
          return;
        }

        let fileExist = true;
        await drive.get(filepath, { content: false }).catch(() => {
          fileExist = false;
        });

        if (!fileExist) {
          showErrorMessage(
            'Error opening chat',
            `'${filepath}' is not a valid path`
          );
          return;
        }

        commands.execute('docmanager:open', {
          path: `RTC:${filepath}`,
          factory: 'chat-factory'
        });
      }
    });

    // Add the commands to the palette
    if (commandPalette) {
      commandPalette.addItem({
        category: 'Chat',
        command: CommandIDs.createChat,
        args: { isPalette: true }
      });
      commandPalette.addItem({
        category: 'Chat',
        command: CommandIDs.openChat
      });
    }

    // Add the create command to the launcher
    if (launcher) {
      launcher.add({
        command: CommandIDs.createChat,
        category: 'Chat',
        rank: 1
      });
    }
  }
};

export default [chatDocument, chatCommands];
