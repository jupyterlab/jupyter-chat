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
    this._getTooltip = options.getTooltip;
    this._update();
    this._model.nameChanged.connect(this._update, this);
    // The tooltip may depend on something else than the name (e.g. the path of
    // the chat file), refresh it before it is displayed.
    this.node.addEventListener('pointerenter', this._updateTooltip);
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
    this.node.removeEventListener('pointerenter', this._updateTooltip);
    super.dispose();
  }

  /**
   * Update the displayed name.
   */
  private _update(): void {
    this.node.textContent = this._model.name;
    this._updateTooltip();
  }

  /**
   * Update the tooltip, defaulting to the model name.
   */
  private _updateTooltip = (): void => {
    this.node.title = this._getTooltip?.(this._model) || this._model.name;
  };

  private _model: IChatModel;
  private _getTooltip?: (model: IChatModel) => string | undefined;
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
    /**
     * An optional function returning the tooltip of the chat name (e.g. the
     * path of the chat file). Defaults to the model name.
     */
    getTooltip?: (model: IChatModel) => string | undefined;
  }
}
