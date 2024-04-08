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
import { IThemeManager, WidgetTracker } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Awareness } from 'y-protocols/awareness';

import { ChatWidgetFactory, CollaborativeChatModelFactory } from './factory';
import { IChatFileType } from './token';
import { CollaborativeChatWidget } from './widget';
import { YChat } from './ychat';

const pluginIds = {
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

export default chatDocument;
