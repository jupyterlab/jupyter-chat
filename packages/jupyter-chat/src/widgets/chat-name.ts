/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Widget } from '@lumino/widgets';

import { IChatModel } from '../model';

const CHAT_NAME_CLASS = 'jp-chat-name';

/**
 * A widget displaying the name of a chat, to be added in a toolbar.
 *
 * The displayed name follows the model name.
 */
export class ChatName extends Widget {
  constructor(options: ChatName.IOptions) {
    super({ node: document.createElement('span') });
    this.addClass(CHAT_NAME_CLASS);
    this._model = options.model;
    this._update();
    this._model.nameChanged.connect(this._update, this);
  }

  /**
   * The model of the chat.
   */
  get model(): IChatModel {
    return this._model;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._model.nameChanged.disconnect(this._update, this);
    super.dispose();
  }

  /**
   * Update the displayed name.
   */
  private _update(): void {
    const name = this._model.name;
    this.node.textContent = name;
    this.node.title = name;
  }

  private _model: IChatModel;
}

/**
 * The chat name namespace.
 */
export namespace ChatName {
  /**
   * The options of the chat name constructor.
   */
  export interface IOptions {
    /**
     * The model of the chat.
     */
    model: IChatModel;
  }
}
