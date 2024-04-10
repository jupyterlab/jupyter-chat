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
  InputDialog,
  WidgetTracker,
  showErrorMessage
} from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Awareness } from 'y-protocols/awareness';

import { ChatWidgetFactory, CollaborativeChatModelFactory } from './factory';
import { CommandIDs, IChatFileType } from './token';
import { CollaborativeChatWidget } from './widget';
import { YChat } from './ychat';
import { Contents } from '@jupyterlab/services';

const pluginIds = {
  chatCreation: 'jupyterlab-collaborative-chat:creation',
  chatDocument: 'jupyterlab-collaborative-chat:chat-document'
};

/**
 * Extension registering the chat file type.
 */
export const chatDocument: JupyterFrontEndPlugin<IChatFileType> = {
  id: pluginIds.chatDocument,
  description: 'A document registration for collaborative chat',
  autoStart: true,
  requires: [IGlobalAwareness, IRenderMimeRegistry],
  optional: [ICollaborativeDrive, ILayoutRestorer, IThemeManager],
  provides: IChatFileType,
  activate: (
    app: JupyterFrontEnd,
    awareness: Awareness,
    rmRegistry: IRenderMimeRegistry,
    drive: ICollaborativeDrive | null,
    restorer: ILayoutRestorer | null,
    themeManager: IThemeManager | null
  ): IChatFileType => {
    // Namespace for the tracker
    const namespace = 'chat';

    // Creating the tracker for the document
    const tracker = new WidgetTracker<CollaborativeChatWidget>({ namespace });

    const chatFileType: IChatFileType = {
      name: 'chat',
      displayName: 'Chat',
      mimeTypes: ['text/json', 'application/json'],
      extensions: ['.chat'],
      fileFormat: 'text',
      contentType: 'chat'
    };

    app.docRegistry.addFileType(chatFileType);

    if (drive) {
      const chatFactory = () => {
        return YChat.create();
      };
      drive.sharedModelFactory.registerDocumentFactory('chat', chatFactory);
    }

    // Creating and registering the model factory for our custom DocumentModel
    const modelFactory = new CollaborativeChatModelFactory({ awareness });
    app.docRegistry.addModelFactory(modelFactory);

    // Creating the widget factory to register it so the document manager knows about
    // our new DocumentWidget
    const widgetFactory = new ChatWidgetFactory({
      name: 'chat-factory',
      modelName: 'chat',
      fileTypes: ['chat'],
      defaultFor: ['chat'],
      themeManager,
      rmRegistry
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
        args: panel => ({ path: panel.context.path, factory: 'chat-factory' }),
        name: panel => panel.context.path,
        when: app.serviceManager.ready
      });
    }

    return chatFileType;
  }
};

/**
 * Extension registering the chat file type.
 */
export const chatCreation: JupyterFrontEndPlugin<void> = {
  id: pluginIds.chatCreation,
  description: 'The commands to create or open a chat',
  autoStart: true,
  requires: [IChatFileType, ICollaborativeDrive],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    chatFileType: IChatFileType,
    drive: ICollaborativeDrive,
    commandPalette: ICommandPalette
  ) => {
    const { commands } = app;

    /**
     * Command to create a new chat.
     *
     * args:
     *  name: the name of the chat to create.
     */
    commands.addCommand(CommandIDs.createChat, {
      label: 'Create a chat',
      execute: async args => {
        let name: string | null = (args.name as string) ?? null;
        let filepath = '';
        if (!name) {
          name = (
            await InputDialog.getText({
              label: 'Name',
              placeholder: 'untitled',
              title: 'Name of the chat'
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
        await drive.get(filepath, { content: false }).catch(() => {
          fileExist = false;
        });

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
        if (!filepath) {
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

    if (commandPalette) {
      commandPalette.addItem({
        category: 'Chat',
        command: CommandIDs.createChat
      });
      commandPalette.addItem({
        category: 'Chat',
        command: CommandIDs.openChat
      });
    }
  }
};

export default [chatDocument, chatCreation];
