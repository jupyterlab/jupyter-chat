/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

<<<<<<< HEAD
import { ChatWidget, IChatModel } from '@jupyter/chat';
=======
import {
  ChatWidget,
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IChatModel,
  IInputToolbarRegistry,
  IMessageFooterRegistry,
  readIcon,
  WriterComponent
} from '@jupyter/chat';
import { Contents } from '@jupyterlab/services';
import { IThemeManager } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
>>>>>>> 04982b7 (Add the writer component plugin to alow third party extension to provide it)
import { DocumentWidget } from '@jupyterlab/docregistry';

import { LabChatModel } from './model';

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
