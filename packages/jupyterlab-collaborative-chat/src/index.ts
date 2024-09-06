/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ActiveCellManager,
  AutocompletionRegistry,
  IActiveCellManager,
  IAutocompletionRegistry,
  chatIcon,
  readIcon
} from '@jupyter/chat';
import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/docprovider';
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
import { PathExt } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { ILauncher } from '@jupyterlab/launcher';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IObservableList } from '@jupyterlab/observables';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { launchIcon } from '@jupyterlab/ui-components';

import {
  WidgetConfig,
  ChatWidgetFactory,
  CollaborativeChatModelFactory
} from './factory';
import { CollaborativeChatModel } from './model';
import {
  chatFileType,
  CommandIDs,
  IChatPanel,
  IChatFactory,
  IActiveCellManagerToken
} from './token';
import { ChatPanel, CollaborativeChatPanel } from './widget';
import { YChat } from './ychat';

const FACTORY = 'Chat';

const pluginIds = {
  activeCellManager: 'jupyterlab-collaborative-chat:activeCellManager',
  autocompletionRegistry:
    'jupyterlab-collaborative-chat:autocompletionRegistry',
  chatCommands: 'jupyterlab-collaborative-chat:commands',
  docFactories: 'jupyterlab-collaborative-chat:factory',
  chatPanel: 'jupyterlab-collaborative-chat:chat-panel'
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
 * Extension registering the chat file type.
 */
const docFactories: JupyterFrontEndPlugin<IChatFactory> = {
  id: pluginIds.docFactories,
  description: 'A document factories for collaborative chat',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [
    IActiveCellManagerToken,
    IAutocompletionRegistry,
    ICollaborativeDrive,
    ILayoutRestorer,
    ISettingRegistry,
    IThemeManager,
    IToolbarWidgetRegistry,
    ITranslator
  ],
  provides: IChatFactory,
  activate: (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    activeCellManager: IActiveCellManager | null,
    autocompletionRegistry: IAutocompletionRegistry,
    drive: ICollaborativeDrive | null,
    restorer: ILayoutRestorer | null,
    settingRegistry: ISettingRegistry | null,
    themeManager: IThemeManager | null,
    toolbarRegistry: IToolbarWidgetRegistry | null,
    translator_: ITranslator | null
  ): IChatFactory => {
    const translator = translator_ ?? nullTranslator;

    // Declare the toolbar factory.
    let toolbarFactory:
      | ((
          widget: CollaborativeChatPanel
        ) =>
          | DocumentRegistry.IToolbarItem[]
          | IObservableList<DocumentRegistry.IToolbarItem>)
      | undefined;

    /**
     * Load the settings for the chat widgets.
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
      widgetConfig.config = {
        sendWithShiftEnter,
        stackMessages,
        unreadNotifications,
        enableCodeToolbar
      };
    }

    if (settingRegistry) {
      // Create the main area widget toolbar factory.
      if (toolbarRegistry) {
        toolbarFactory = createToolbarFactory(
          toolbarRegistry,
          settingRegistry,
          FACTORY,
          pluginIds.docFactories,
          translator
        );
      }

      // Wait for the application to be restored and
      // for the settings to be loaded
      Promise.all([app.restored, settingRegistry.load(pluginIds.docFactories)])
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

    /**
     * The chat config object.
     */
    const widgetConfig = new WidgetConfig({
      sendWithShiftEnter,
      stackMessages,
      unreadNotifications,
      enableCodeToolbar
    });

    // Namespace for the tracker
    const namespace = 'chat';

    // Creating the tracker for the document
    const tracker = new WidgetTracker<CollaborativeChatPanel>({ namespace });

    app.docRegistry.addFileType(chatFileType);

    if (drive) {
      const chatFactory: SharedDocumentFactory = () => {
        return YChat.create();
      };
      drive.sharedModelFactory.registerDocumentFactory('chat', chatFactory);
    }

    app.serviceManager.ready
      .then(() => {
        const user = app.serviceManager.user.identity;
        // Creating and registering the model factory for our custom DocumentModel
        const modelFactory = new CollaborativeChatModelFactory({
          user,
          widgetConfig,
          commands: app.commands,
          activeCellManager
        });
        app.docRegistry.addModelFactory(modelFactory);
      })
      .catch(e =>
        console.error(
          'The collaborative chat model factory is not initialized',
          e
        )
      );

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
      translator,
      autocompletionRegistry
    });

    // Add the widget to the tracker when it's created
    widgetFactory.widgetCreated.connect((sender, widget) => {
      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        tracker.save(widget);
      });
      tracker.add(widget);

      // Update the 'markAsRead' command status when the unread changed.
      widget.model.unreadChanged.connect(() =>
        app.commands.notifyCommandChanged(CommandIDs.markAsRead)
      );
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

    return { widgetConfig, tracker };
  }
};

/**
 * Extension providing the commands, menu and laucher.
 */
const chatCommands: JupyterFrontEndPlugin<void> = {
  id: pluginIds.chatCommands,
  description: 'The commands to create or open a chat',
  autoStart: true,
  requires: [ICollaborativeDrive, IChatFactory],
  optional: [IActiveCellManagerToken, IChatPanel, ICommandPalette, ILauncher],
  activate: (
    app: JupyterFrontEnd,
    drive: ICollaborativeDrive,
    factory: IChatFactory,
    activeCellManager: IActiveCellManager | null,
    chatPanel: ChatPanel | null,
    commandPalette: ICommandPalette | null,
    launcher: ILauncher | null
  ) => {
    const { commands } = app;
    const { tracker, widgetConfig } = factory;
    /**
     * Command to create a new chat.
     *
     * args:
     *  name -        optional, the name of the chat to create.
     *                Open a dialog if not provided.
     *  inSidePanel - optional (default to false).
     *                Whether to open the chat in side panel or in main area.
     *  isPalette -   optional (default to false).
     *                Whether the command is in commands palette or not.
     */
    commands.addCommand(CommandIDs.createChat, {
      label: args => (args.isPalette ? 'Create a new chat' : 'Chat'),
      caption: 'Create a chat',
      icon: args => (args.isPalette ? undefined : chatIcon),
      execute: async args => {
        const inSidePanel: boolean = (args.inSidePanel as boolean) ?? false;
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

        if (commands.hasCommand(CommandIDs.openChat)) {
          return commands.execute(CommandIDs.openChat, {
            filepath,
            inSidePanel
          });
        } else {
          commands.execute('docmanager:open', {
            path: `RTC:${filepath}`,
            factory: FACTORY
          });
        }
      }
    });

    // Add the command to the palette
    if (commandPalette) {
      commandPalette.addItem({
        category: 'Chat',
        command: CommandIDs.createChat,
        args: { isPalette: true }
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

    // The command to mark the chat as read.
    commands.addCommand(CommandIDs.markAsRead, {
      caption: 'Mark chat as read',
      icon: readIcon,
      isEnabled: () =>
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget &&
        tracker.currentWidget.model.unreadMessages.length > 0,
      execute: async args => {
        const widget = app.shell.currentWidget;
        // Ensure widget is a CollaborativeChatPanel and is in main area
        if (
          !widget ||
          !(widget instanceof CollaborativeChatPanel) ||
          !Array.from(app.shell.widgets('main')).includes(widget)
        ) {
          console.error(
            `The command '${CommandIDs.markAsRead}' should be executed from the toolbar button only`
          );
          return;
        }
        widget.model.unreadMessages = [];
      }
    });

    // Update the 'markAsRead' command status when the current widget changes.
    tracker.currentChanged.connect(() => {
      commands.notifyCommandChanged(CommandIDs.markAsRead);
    });

    app.serviceManager.ready
      .then(() => {
        const user = app.serviceManager.user.identity;
        /*
         * Command to open a chat.
         *
         * args:
         *  filepath - the chat file to open.
         */
        commands.addCommand(CommandIDs.openChat, {
          label: 'Open a chat',
          execute: async args => {
            const inSidePanel: boolean = (args.inSidePanel as boolean) ?? false;
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

            if (inSidePanel && chatPanel) {
              // The chat is opened in the chat panel.
              app.shell.activateById(chatPanel.id);
              const model = await drive.get(filepath);

              /**
               * Create a share model from the chat file
               */
              const sharedModel = drive.sharedModelFactory.createNew({
                path: model.path,
                format: model.format,
                contentType: chatFileType.contentType,
                collaborative: true
              }) as YChat;

              /**
               * Initialize the chat model with the share model
               */
              const chat = new CollaborativeChatModel({
                user,
                sharedModel,
                widgetConfig,
                commands: app.commands,
                activeCellManager
              });

              /**
               * Add a chat widget to the side panel.
               */
              chatPanel.addChat(
                chat,
                PathExt.basename(model.name, chatFileType.extensions[0])
              );
            } else {
              // The chat is opened in the main area
              commands.execute('docmanager:open', {
                path: `RTC:${filepath}`,
                factory: FACTORY
              });
            }
          }
        });

        // Add the command to the palette
        if (commandPalette) {
          commandPalette.addItem({
            category: 'Chat',
            command: CommandIDs.openChat
          });
        }
      })
      .catch(e =>
        console.error('The command to open a chat is not initialized\n', e)
      );
  }
};

/*
 * Extension providing a chat panel.
 */
const chatPanel: JupyterFrontEndPlugin<ChatPanel> = {
  id: pluginIds.chatPanel,
  description: 'A chat extension for Jupyter',
  autoStart: true,
  provides: IChatPanel,
  requires: [ICollaborativeDrive, IRenderMimeRegistry],
  optional: [
    IAutocompletionRegistry,
    ILayoutRestorer,
    INotebookTracker,
    IThemeManager
  ],
  activate: (
    app: JupyterFrontEnd,
    drive: ICollaborativeDrive,
    rmRegistry: IRenderMimeRegistry,
    autocompletionRegistry: IAutocompletionRegistry,
    restorer: ILayoutRestorer | null,
    notebookTracker: INotebookTracker,
    themeManager: IThemeManager | null
  ): ChatPanel => {
    const { commands } = app;

    /**
     * Add Chat widget to left sidebar
     */
    const chatPanel = new ChatPanel({
      commands,
      drive,
      rmRegistry,
      themeManager,
      autocompletionRegistry
    });
    chatPanel.id = 'JupyterCollaborationChat:sidepanel';
    chatPanel.title.icon = chatIcon;
    chatPanel.title.caption = 'Jupyter Chat'; // TODO: i18n/

    app.shell.add(chatPanel, 'left', {
      rank: 2000
    });

    if (restorer) {
      restorer.add(chatPanel, 'jupyter-chat');
    }

    // Use events system to watch changes on files.
    const schemaID =
      'https://events.jupyter.org/jupyter_server/contents_service/v1';
    const actions = ['create', 'delete', 'rename'];
    app.serviceManager.events.stream.connect((_, emission) => {
      if (emission.schema_id === schemaID) {
        const action = emission.action as string;
        if (actions.includes(action)) {
          chatPanel.updateChatNames();
        }
      }
    });

    /*
     * Command to move a chat from the main area to the side panel.
     *
     */
    commands.addCommand(CommandIDs.moveToSide, {
      label: 'Move the chat to the side panel',
      caption: 'Move the chat to the side panel',
      icon: launchIcon,
      isEnabled: () => commands.hasCommand(CommandIDs.openChat),
      execute: async () => {
        const widget = app.shell.currentWidget;
        // Ensure widget is a CollaborativeChatPanel and is in main area
        if (
          !widget ||
          !(widget instanceof CollaborativeChatPanel) ||
          !Array.from(app.shell.widgets('main')).includes(widget)
        ) {
          console.error(
            `The command '${CommandIDs.moveToSide}' should be executed from the toolbar button only`
          );
          return;
        }
        // Remove potential drive prefix
        const filepath = widget.context.path.split(':').pop();
        commands.execute(CommandIDs.openChat, {
          filepath,
          inSidePanel: true
        });
        widget.dispose();
      }
    });

    return chatPanel;
  }
};

/**
 * Extension providing the active cell manager.
 */
const activeCellManager: JupyterFrontEndPlugin<IActiveCellManager> = {
  id: pluginIds.activeCellManager,
  description: 'the active cell manager plugin',
  autoStart: true,
  requires: [INotebookTracker],
  provides: IActiveCellManagerToken,
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker
  ): IActiveCellManager => {
    return new ActiveCellManager({
      tracker: notebookTracker,
      shell: app.shell
    });
  }
};

export default [
  activeCellManager,
  autocompletionPlugin,
  chatCommands,
  docFactories,
  chatPanel
];
