/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatWidget } from 'chat-jupyter';
import { DocumentWidget } from '@jupyterlab/docregistry';

import { CollaborativeChatModel } from './model';

/**
 * DocumentWidget: widget that represents the view or editor for a file type.
 */
export class CollaborativeChatWidget extends DocumentWidget<
  ChatWidget,
  CollaborativeChatModel
> {
  constructor(
    options: DocumentWidget.IOptions<ChatWidget, CollaborativeChatModel>
  ) {
    super(options);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.content.dispose();
    super.dispose();
  }

  /**
   * The model for the widget.
   */
  get model(): CollaborativeChatModel | null {
    return this.content.model as CollaborativeChatModel;
  }
}
