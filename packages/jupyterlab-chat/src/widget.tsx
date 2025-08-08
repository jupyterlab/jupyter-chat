/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatWidget,
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IChatModel,
  IMessageFooterRegistry
} from '@jupyter/chat';
import { MultiChatPanel } from '@jupyter/chat';
import { Contents } from '@jupyterlab/services';
import { IThemeManager } from '@jupyterlab/apputils';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';

import { LabChatModel } from './model';
import {
  CommandIDs,
  IInputToolbarRegistryFactory,
  chatFileType
} from './token';

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
  const panel = new MultiChatPanel({
    commands: options.commands,
    contentsManager: options.contentsManager,
    rmRegistry: options.rmRegistry,
    themeManager: options.themeManager,
    defaultDirectory: options.defaultDirectory,
    chatFileExtension: chatFileType.extensions[0],
    createChatCommand: CommandIDs.createChat,
    openChatCommand: CommandIDs.openChat,
    chatCommandRegistry: options.chatCommandRegistry,
    attachmentOpenerRegistry: options.attachmentOpenerRegistry,
    inputToolbarFactory: options.inputToolbarFactory,
    messageFooterRegistry: options.messageFooterRegistry,
    welcomeMessage: options.welcomeMessage
  });

  return panel;
}
