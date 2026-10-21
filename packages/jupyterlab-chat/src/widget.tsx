/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatArea, ChatWidget, IChatModel, IChatPanel } from '@jupyter/chat';
import { Notification } from '@jupyterlab/apputils';
import { DocumentWidget } from '@jupyterlab/docregistry';

import { LabChatModel } from './model';

const MAIN_PANEL_CLASS = 'jp-lab-chat-main-panel';
const TITLE_UNREAD_CLASS = 'jp-lab-chat-title-unread';

/**
 * DocumentWidget: widget that represents the view or editor for a file type.
 */
export class LabChatPanel
  extends DocumentWidget<ChatWidget, LabChatModel>
  implements IChatPanel
{
  constructor(options: DocumentWidget.IOptions<ChatWidget, LabChatModel>) {
    super(options);
    this.addClass(MAIN_PANEL_CLASS);
    this.model.name = this.context.localPath;
    this.model.unreadChanged.connect(this._unreadChanged);
    // The context is ready once the document content has been loaded, which is
    // when the chat can be given an ID and become usable.
    this.context.ready
      .then(() => this.model.markDocumentSynced())
      .catch(e => console.error('The chat document failed to load', e));
    // If the chat can never become ready (e.g. the server closed the WebSocket
    // because the path was invalid), dispose this widget so no loading spinner
    // is left hanging, and let the user know.
    this.model.ready.catch(() => {
      Notification.error(
        `Unable to open chat at given path: '${this.model.name}'.`
      );
      this.dispose();
    });
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
   * The chat widget.
   */
  get widget(): ChatWidget {
    return this.content;
  }

  /**
   * The model for the widget.
   */
  get model(): LabChatModel {
    return this.context.model;
  }

  /**
   * The area of the widget.
   */
  get area(): ChatArea {
    return 'main';
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
