/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import { Chat } from '../components/chat';
import { chatIcon } from '../icons';
import { IChatModel } from '../model';

export class ChatWidget extends ReactWidget {
  constructor(options: Chat.IOptions) {
    super();

    this.title.icon = chatIcon;
    this.title.caption = 'Jupyter Chat'; // TODO: i18n

    this._chatOptions = options;
    this.id = `jupyter-chat::widget::${options.model.name}`;
    this.node.onclick = () => this.model.focusInput();
  }

  /**
   * Get the model of the widget.
   */
  get model(): IChatModel {
    return this._chatOptions.model;
  }

  render() {
    // The model need to be passed, otherwise it is undefined in the widget in
    // the case of collaborative document.
    return <Chat {...this._chatOptions} model={this._chatOptions.model} />;
  }

  private _chatOptions: Chat.IOptions;
}
