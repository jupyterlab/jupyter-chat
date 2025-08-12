/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatWidget,
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IChatModel,
  IMessageFooterRegistry,
  IInputToolbarRegistryFactory
} from '@jupyter/chat';
import { MultiChatPanel, ChatSection } from '@jupyter/chat';
import { Contents } from '@jupyterlab/services';
import { IThemeManager } from '@jupyterlab/apputils';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';

import { LabChatModel } from './model';
import { CommandIDs, chatFileType } from './token';

const MAIN_PANEL_CLASS = 'jp-lab-chat-main-panel';
const TITLE_UNREAD_CLASS = 'jp-lab-chat-title-unread';

/**
 * DocumentWidget: widget that represents the view or editor for a file type.
 */
export class LabChatPanel extends DocumentWidget<ChatWidget, LabChatModel> {
  constructor(options: DocumentWidget.IOptions<ChatWidget, LabChatModel>) {
    super(options);
    this.addClass(MAIN_PANEL_CLASS);
    this.model.name = this.context.localPath;
    this.model.unreadChanged.connect(this._unreadChanged);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.model.unreadChanged.disconnect(this._unreadChanged);
    this.context.dispose();
    this.content.dispose();
    super.dispose();
  }

  /**
   * The model for the widget.
   */
  get model(): LabChatModel {
    return this.context.model;
  }

  /**
   * Add class to tab when messages are unread.
   */
  private _unreadChanged = (_: IChatModel, unread: number[]) => {
    if (unread.length) {
      if (!this.title.className.includes(TITLE_UNREAD_CLASS)) {
        this.title.className += ` ${TITLE_UNREAD_CLASS}`;
      }
    } else {
      this.title.className = this.title.className.replace(
        TITLE_UNREAD_CLASS,
        ''
      );
    }
  };
}

export function createMultiChatPanel(options: {
  commands: CommandRegistry;
  contentsManager: Contents.IManager;
  rmRegistry: IRenderMimeRegistry;
  themeManager: IThemeManager | null;
  defaultDirectory: string;
  chatCommandRegistry?: IChatCommandRegistry;
  attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
  inputToolbarFactory?: IInputToolbarRegistryFactory;
  messageFooterRegistry?: IMessageFooterRegistry;
  welcomeMessage?: string;
}): MultiChatPanel {
  const { contentsManager, defaultDirectory } = options;
  const chatFileExtension = chatFileType.extensions[0];

  // This function replaces updateChatList's file lookup
  const getChatNames = async () => {
    const dirContents = await contentsManager.get(defaultDirectory);
    const names: { [name: string]: string } = {};
    for (const file of dirContents.content) {
      if (file.type === 'file' && file.name.endsWith(chatFileExtension)) {
        const nameWithoutExt = file.name.replace(chatFileExtension, '');
        names[nameWithoutExt] = file.path;
      }
    }
    return names;
  };

  // Hook that fires when files change
  const onChatsChanged = (cb: () => void) => {
    contentsManager.fileChanged.connect((_sender, change) => {
      if (
        change.type === 'new' ||
        change.type === 'delete' ||
        (change.type === 'rename' &&
          change.oldValue?.path !== change.newValue?.path)
      ) {
        cb();
      }
    });
  };

  return new MultiChatPanel({
    rmRegistry: options.rmRegistry,
    themeManager: options.themeManager,
    defaultDirectory: options.defaultDirectory,
    chatFileExtension: chatFileType.extensions[0],
    getChatNames,
    onChatsChanged,
    createChat: () => {
      options.commands.execute(CommandIDs.createChat);
    },
    openChat: path => {
      options.commands.execute(CommandIDs.openChat, { filepath: path });
    },
    closeChat: path => {
      options.commands.execute(CommandIDs.closeChat, { filepath: path });
    },
    moveToMain: path => {
      options.commands.execute(CommandIDs.moveToMain, { filepath: path });
    },
    renameChat: (
      section: ChatSection.IOptions,
      path: string,
      newName: string
    ) => {
      if (section.widget.title.label !== newName) {
        const newPath = `${defaultDirectory}/${newName}${chatFileExtension}`;
        contentsManager
          .rename(path, newPath)
          .catch(err => console.error('Rename failed:', err));
        section.widget.title.label = newName;
      }
    },
    chatCommandRegistry: options.chatCommandRegistry,
    attachmentOpenerRegistry: options.attachmentOpenerRegistry,
    inputToolbarFactory: options.inputToolbarFactory,
    messageFooterRegistry: options.messageFooterRegistry,
    welcomeMessage: options.welcomeMessage
  });
}
