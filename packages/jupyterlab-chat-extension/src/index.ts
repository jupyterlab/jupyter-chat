/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { NotebookShell } from '@jupyter-notebook/application';
import {
  ActiveCellManager,
  AttachmentOpenerRegistry,
  ChatWidget,
  IActiveCellManager,
  IAttachment,
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IMessageFooterRegistry,
  ISelectionWatcher,
  InputToolbarRegistry,
  MessageFooterRegistry,
  SelectionWatcher,
  chatIcon,
  readIcon
} from '@jupyter/chat';
import { ICollaborativeContentProvider } from '@jupyter/collaborative-drive';
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
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { PathExt } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { ILauncher } from '@jupyterlab/launcher';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IObservableList } from '@jupyterlab/observables';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { launchIcon } from '@jupyterlab/ui-components';
import { PromiseDelegate } from '@lumino/coreutils';
import {
  ChatPanel,
  ChatWidgetFactory,
  CommandIDs,
  IActiveCellManagerToken,
  IChatFactory,
  IChatPanel,
  IInputToolbarRegistryFactory,
  ISelectionWatcherToken,
  IWelcomeMessage,
  LabChatModel,
  LabChatModelFactory,
  LabChatPanel,
  WidgetConfig,
  YChat,
  chatFileType
} from 'jupyterlab-chat';
import { chatCommandRegistryPlugin } from './chat-commands/plugins';
import { emojiCommandsPlugin } from './chat-commands/providers/emoji';
import { mentionCommandsPlugin } from './chat-commands/providers/user-mention';

const FACTORY = 'Chat';

const pluginIds = {
  activeCellManager: 'jupyterlab-chat-extension:activeCellManager',
  attachmentOpenerRegistry: 'jupyterlab-chat-extension:attachmentOpener',
  chatCommands: 'jupyterlab-chat-extension:commands',
  chatPanel: 'jupyterlab-chat-extension:chat-panel',
  docFactories: 'jupyterlab-chat-extension:factory',
  inputToolbarFactory: 'jupyterlab-chat-extension:inputToolbarFactory',
  selectionWatcher: 'jupyterlab-chat-extension:selectionWatcher'
};

/**
 * Extension providing the attachment opener registry.
 */
const attachmentOpeners: JupyterFrontEndPlugin<IAttachmentOpenerRegistry> = {
  id: pluginIds.attachmentOpenerRegistry,
  description: 'The attachment opener registry.',
  autoStart: true,
  provides: IAttachmentOpenerRegistry,
  activate: (app: JupyterFrontEnd): IAttachmentOpenerRegistry => {
    const attachmentOpenerRegistry = new AttachmentOpenerRegistry();

    attachmentOpenerRegistry.set('file', (attachment: IAttachment) => {
      app.commands.execute('docmanager:open', { path: attachment.value });
    });

    attachmentOpenerRegistry.set('notebook', (attachment: IAttachment) => {
      app.commands.execute('docmanager:open', { path: attachment.value });
    });

    return attachmentOpenerRegistry;
  }
};

/**
 * Extension registering the chat file type.
 */
const docFactories: JupyterFrontEndPlugin<IChatFactory> = {
  id: pluginIds.docFactories,
  description: 'Document factories for chat.',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [
    IActiveCellManagerToken,
    IAttachmentOpenerRegistry,
    IChatCommandRegistry,
    ICollaborativeContentProvider,
    IDefaultFileBrowser,
    IInputToolbarRegistryFactory,
    ILayoutRestorer,
    IMessageFooterRegistry,
    ISelectionWatcherToken,
    ISettingRegistry,
    IThemeManager,
    IToolbarWidgetRegistry,
    ITranslator,
    IWelcomeMessage
  ],
  provides: IChatFactory,
  activate: (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    activeCellManager: IActiveCellManager | null,
    attachmentOpenerRegistry: IAttachmentOpenerRegistry,
    chatCommandRegistry: IChatCommandRegistry,
    drive: ICollaborativeContentProvider | null,
    filebrowser: IDefaultFileBrowser | null,
    inputToolbarFactory: IInputToolbarRegistryFactory,
    restorer: ILayoutRestorer | null,
    messageFooterRegistry: IMessageFooterRegistry,
    selectionWatcher: ISelectionWatcher | null,
    settingRegistry: ISettingRegistry | null,
    themeManager: IThemeManager | null,
    toolbarRegistry: IToolbarWidgetRegistry | null,
    translator_: ITranslator | null,
    welcomeMessage: string
  ): IChatFactory => {
    const translator = translator_ ?? nullTranslator;

    // Declare the toolbar factory.
    let toolbarFactory:
      | ((
          widget: LabChatPanel
        ) =>
          | DocumentRegistry.IToolbarItem[]
          | IObservableList<DocumentRegistry.IToolbarItem>)
      | undefined;

    /**
     * The chat config object.
     */
    const widgetConfig = new WidgetConfig({});

    /**
     * Load the settings for the chat widgets.
     */
    function loadSetting(setting: ISettingRegistry.ISettings): void {
      // Remove the previous directory if it is empty and has changed.
      const previousDirectory = widgetConfig.config.defaultDirectory;
      const currentDirectory = setting.get('defaultDirectory')
        .composite as string;

      if (
        drive &&
        previousDirectory &&
        previousDirectory !== currentDirectory
      ) {
        app.serviceManager.contents
          .get(previousDirectory)
          .then(contentModel => {
            if (contentModel.content.length === 0) {
              app.serviceManager.contents.delete(previousDirectory).catch(e => {
                // no-op, the directory might not be empty
              });
            }
          })
          .catch(() => {
            // no-op, the directory does not exists.
          });
      }

      // Create the new directory if necessary.
      let directoryCreation: Promise<Contents.IModel | null> =
        Promise.resolve(null);

      if (drive && currentDirectory && previousDirectory !== currentDirectory) {
        directoryCreation = app.serviceManager.contents
          .get(currentDirectory, { content: false })
          .catch(async () => {
            return app.serviceManager.contents
              .newUntitled({
                type: 'directory'
              })
              .then(async contentModel => {
                return app.serviceManager.contents
                  .rename(contentModel.path, currentDirectory)
                  .catch(e => {
                    app.serviceManager.contents.delete(contentModel.path);
                    throw new Error(e);
                  });
              })
              .catch(e => {
                throw new Error(e);
              });
          });
      }

      // Wait for the new directory to be created to update the config, to avoid error
      // trying to read that directory to update the chat list in the side panel.
      directoryCreation.then(() => {
        widgetConfig.config = {
          sendWithShiftEnter: setting.get('sendWithShiftEnter')
            .composite as boolean,
          stackMessages: setting.get('stackMessages').composite as boolean,
          unreadNotifications: setting.get('unreadNotifications')
            .composite as boolean,
          enableCodeToolbar: setting.get('enableCodeToolbar')
            .composite as boolean,
          sendTypingNotification: setting.get('sendTypingNotification')
            .composite as boolean,
          defaultDirectory: currentDirectory
        };
      });
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

    // Namespace for the tracker
    const namespace = 'chat';

    // Creating the tracker for the document
    const tracker = new WidgetTracker<LabChatPanel | ChatWidget>({ namespace });
    app.docRegistry.addFileType(chatFileType);

    if (drive) {
      const chatFactory = () => YChat.create();
      drive.sharedModelFactory.registerDocumentFactory('chat', chatFactory);
    }

    app.serviceManager.ready
      .then(() => {
        const user = app.serviceManager.user.identity;
        // Creating and registering the model factory for our custom DocumentModel
        const modelFactory = new LabChatModelFactory({
          user,
          widgetConfig,
          commands: app.commands,
          activeCellManager,
          selectionWatcher,
          documentManager: filebrowser?.model.manager
        });
        app.docRegistry.addModelFactory(modelFactory);
      })
      .catch(e =>
        console.error('The jupyterlab chat model factory is not initialized', e)
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
      chatCommandRegistry,
      attachmentOpenerRegistry,
      inputToolbarFactory,
      messageFooterRegistry,
      welcomeMessage
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
      // Promise that resolve when the openChat command is ready.
      const openCommandReady = new PromiseDelegate<void>();
      const commandChanged = () => {
        if (app.commands.hasCommand(CommandIDs.openChat)) {
          openCommandReady.resolve();
          app.commands.commandChanged.disconnect(commandChanged);
        }
      };
      app.commands.commandChanged.connect(commandChanged);

      void restorer.restore(tracker, {
        command: CommandIDs.openChat,
        args: widget => ({
          filepath: widget.model.name ?? '',
          inSidePanel: widget instanceof ChatWidget,
          startup: true
        }),
        name: widget => widget.model.name,
        when: openCommandReady.promise
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
  description: 'The commands to create or open a chat.',
  autoStart: true,
  requires: [ICollaborativeContentProvider, IChatFactory],
  optional: [
    IActiveCellManagerToken,
    IChatPanel,
    ICommandPalette,
    IDefaultFileBrowser,
    ILauncher,
    ISelectionWatcherToken
  ],
  activate: (
    app: JupyterFrontEnd,
    drive: ICollaborativeContentProvider,
    factory: IChatFactory,
    activeCellManager: IActiveCellManager | null,
    chatPanel: ChatPanel | null,
    commandPalette: ICommandPalette | null,
    filebrowser: IDefaultFileBrowser | null,
    launcher: ILauncher | null,
    selectionWatcher: ISelectionWatcher | null
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
        const targetDirectory: string | undefined = args.path as string;
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
          // Create new chat file in default dir if created from filebrowser
          // as "Open a chat" dropdown only discovers chat files in default
          // dir. Create new chat in file browser cwd if created from main
          // area (launcher, menu, palette).
          if (targetDirectory !== undefined) {
            // Explicit directory provided - use it
            filepath = PathExt.join(targetDirectory, filepath);
          } else if (inSidePanel) {
            // Side panel uses default directory
            const defaultDir = widgetConfig.config.defaultDirectory ?? '';
            filepath = PathExt.join(defaultDir, filepath);
          } else {
            // Main area uses filebrowser cwd
            const cwd = filebrowser?.model.path ?? '';
            filepath = PathExt.join(cwd, filepath);
          }
        }

        let fileExist = true;
        if (filepath) {
          await app.serviceManager.contents
            .get(filepath, { content: false })
            .catch(() => {
              fileExist = false;
            });
        } else {
          fileExist = false;
        }

        // Create a new file if it does not exists
        if (!fileExist) {
          // Create a new untitled chat.
          let model: Contents.IModel | null =
            await app.serviceManager.contents.newUntitled({
              type: 'file',
              ext: chatFileType.extensions[0]
            });
          // Rename it if a name has been provided.
          if (filepath) {
            model = await app.serviceManager.contents.rename(
              model.path,
              filepath
            );
          }

          if (!model) {
            showErrorMessage(
              'Error creating a chat',
              'An error occurred while creating the chat'
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
          return commands.execute('docmanager:open', {
            // TODO: support JCollab v3 by optionally prefixing 'RTC:'
            path: `${filepath}`,
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
        category: 'Other'
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
        // Ensure widget is a LabChatPanel and is in main area
        if (
          !widget ||
          !(widget instanceof LabChatPanel) ||
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
         *  startup - optional (default to false).
         *            Whether the command is called during startup restoration.
         */
        commands.addCommand(CommandIDs.openChat, {
          label: 'Open a chat',
          execute: async args => {
            const inSidePanel: boolean = (args.inSidePanel as boolean) ?? false;
            const startup: boolean = (args.startup as boolean) ?? false;
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
            await app.serviceManager.contents
              .get(filepath, { content: false })
              .catch(() => {
                fileExist = false;
              });

            if (!fileExist) {
              if (startup) {
                console.warn(
                  `Chat file '${filepath}' not found during startup restoration`
                );
              } else {
                showErrorMessage(
                  'Error opening chat',
                  `'${filepath}' is not a valid path`
                );
              }
              return;
            }

            if (inSidePanel && chatPanel) {
              /**
               * The chat is opened in the chat panel, ensure the chat panel is opened.
               *
               * NOTES: In Notebook application, the panel is collapsed when using the
               * `activateById` when it is already opened.
               * See https://github.com/jupyter/notebook/issues/7534
               */
              if (app.shell instanceof NotebookShell) {
                const shell: NotebookShell = app.shell;
                if (
                  shell.leftHandler?.currentWidget?.id !== chatPanel.id ||
                  !shell.leftHandler.isVisible
                ) {
                  shell.activateById(chatPanel.id);
                }
              } else {
                app.shell.activateById(chatPanel.id);
              }

              if (chatPanel.openIfExists(filepath)) {
                return;
              }

              const model = await app.serviceManager.contents.get(filepath);

              // Create a share model from the chat file
              const sharedModel = drive.sharedModelFactory.createNew({
                path: model.path,
                format: model.format,
                contentType: chatFileType.contentType,
                collaborative: true
              }) as YChat;

              // Initialize the chat model with the share model
              const chatModel = new LabChatModel({
                user,
                sharedModel,
                widgetConfig,
                commands,
                activeCellManager,
                selectionWatcher,
                documentManager: filebrowser?.model.manager
              });

              // Set the name of the model.
              chatModel.name = model.path;

              // Add a chat widget to the side panel and to the tracker.
              const widget = chatPanel.addChat(chatModel);
              factory.tracker.add(widget);
            } else {
              // The chat is opened in the main area
              // TODO: support JCollab v3 by optionally prefixing 'RTC:'
              return commands.execute('docmanager:open', {
                path: `${filepath}`,
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

    // The command to focus the input of the current chat widget.
    commands.addCommand(CommandIDs.focusInput, {
      caption: 'Focus the input of the current chat widget',
      isEnabled: () => tracker.currentWidget !== null,
      execute: () => {
        const widget = tracker.currentWidget;
        if (widget) {
          if (widget instanceof ChatWidget && chatPanel) {
            // The chat is the side panel.
            app.shell.activateById(chatPanel.id);
            chatPanel.openIfExists(widget.model.name);
          } else {
            // The chat is in the main area.
            app.shell.activateById(widget.id);
          }
          widget.model.input.focus();
        }
      }
    });
  }
};

/*
 * Extension providing a chat panel.
 */
const chatPanel: JupyterFrontEndPlugin<ChatPanel> = {
  id: pluginIds.chatPanel,
  description: 'The chat panel widget.',
  autoStart: true,
  provides: IChatPanel,
  requires: [IChatFactory, ICollaborativeContentProvider, IRenderMimeRegistry],
  optional: [
    IAttachmentOpenerRegistry,
    IChatCommandRegistry,
    IInputToolbarRegistryFactory,
    ILayoutRestorer,
    IMessageFooterRegistry,
    IThemeManager,
    IWelcomeMessage
  ],
  activate: (
    app: JupyterFrontEnd,
    factory: IChatFactory,
    drive: ICollaborativeContentProvider,
    rmRegistry: IRenderMimeRegistry,
    attachmentOpenerRegistry: IAttachmentOpenerRegistry,
    chatCommandRegistry: IChatCommandRegistry,
    inputToolbarFactory: IInputToolbarRegistryFactory,
    restorer: ILayoutRestorer | null,
    messageFooterRegistry: IMessageFooterRegistry,
    themeManager: IThemeManager | null,
    welcomeMessage: string
  ): ChatPanel => {
    const { commands } = app;

    const defaultDirectory = factory.widgetConfig.config.defaultDirectory || '';

    /**
     * Add Chat widget to left sidebar
     */
    const chatPanel = new ChatPanel({
      commands,
      contentsManager: app.serviceManager.contents,
      rmRegistry,
      themeManager,
      defaultDirectory,
      chatCommandRegistry,
      attachmentOpenerRegistry,
      inputToolbarFactory,
      messageFooterRegistry,
      welcomeMessage
    });
    chatPanel.id = 'JupyterlabChat:sidepanel';
    chatPanel.title.icon = chatIcon;
    chatPanel.title.caption = 'Jupyter Chat'; // TODO: i18n/

    factory.widgetConfig.configChanged.connect((_, config) => {
      if (config.defaultDirectory !== undefined) {
        chatPanel.defaultDirectory = config.defaultDirectory;
      }
    });

    app.shell.add(chatPanel, 'left', {
      rank: 2000
    });

    if (restorer) {
      restorer.add(chatPanel, 'jupyter-chat');
    }

    // Use events system to watch changes on files, and update the chat list if a chat
    // file has been created, deleted or renamed.
    const schemaID =
      'https://events.jupyter.org/jupyter_server/contents_service/v1';
    const actions = ['create', 'delete', 'rename'];
    app.serviceManager.events.stream.connect((_, emission) => {
      if (emission.schema_id === schemaID) {
        const action = emission.action as string;
        if (
          actions.includes(action) &&
          (emission.path as string).endsWith(chatFileType.extensions[0])
        ) {
          chatPanel.updateChatList();
        }
      }
    });

    /*
     * Command to move a chat from the main area to the side panel.
     */
    commands.addCommand(CommandIDs.moveToSide, {
      label: 'Move the chat to the side panel',
      caption: 'Move the chat to the side panel',
      icon: launchIcon,
      isEnabled: () => commands.hasCommand(CommandIDs.openChat),
      execute: async () => {
        const widget = app.shell.currentWidget;
        // Ensure widget is a LabChatPanel and is in main area
        if (
          !widget ||
          !(widget instanceof LabChatPanel) ||
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
  description: 'The active cell manager plugin.',
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

/**
 * Extension providing the selection watcher.
 */
const selectionWatcher: JupyterFrontEndPlugin<ISelectionWatcher> = {
  id: pluginIds.selectionWatcher,
  description: 'The selection watcher plugin.',
  autoStart: true,
  provides: ISelectionWatcherToken,
  optional: [IEditorLanguageRegistry],
  activate: (
    app: JupyterFrontEnd,
    languages: IEditorLanguageRegistry
  ): ISelectionWatcher => {
    return new SelectionWatcher({
      shell: app.shell,
      languages
    });
  }
};

/**
 * Extension providing the input toolbar registry.
 */
const inputToolbarFactory: JupyterFrontEndPlugin<IInputToolbarRegistryFactory> =
  {
    id: pluginIds.inputToolbarFactory,
    description: 'The input toolbar registry plugin.',
    autoStart: true,
    provides: IInputToolbarRegistryFactory,
    activate: (app: JupyterFrontEnd): IInputToolbarRegistryFactory => {
      return {
        create() {
          return InputToolbarRegistry.defaultToolbarRegistry();
        }
      };
    }
  };

/**
 * Extension providing the message footer registry.
 */
const footerRegistry: JupyterFrontEndPlugin<IMessageFooterRegistry> = {
  id: 'jupyterlab-chat/footerRegistry',
  description: 'The footer registry plugin.',
  autoStart: true,
  provides: IMessageFooterRegistry,
  activate: (app: JupyterFrontEnd): IMessageFooterRegistry => {
    return new MessageFooterRegistry();
  }
};

export default [
  activeCellManager,
  attachmentOpeners,
  chatCommands,
  chatCommandRegistryPlugin,
  chatPanel,
  docFactories,
  footerRegistry,
  inputToolbarFactory,
  selectionWatcher,
  emojiCommandsPlugin,
  mentionCommandsPlugin
];
