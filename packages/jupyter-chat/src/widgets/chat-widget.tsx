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

    this.id = 'jupyter-chat::widget';
    this.title.icon = chatIcon;
    this.title.caption = 'Jupyter Chat'; // TODO: i18n

    this._chatOptions = options;
  }

  /**
   * Get the model of the widget.
   */
  get model(): IChatModel {
    return this._chatOptions.model;
  }

  render() {
    // The model need to be passed, otherwise it is undefined in the widget.
    return <Chat {...this._chatOptions} model={this._chatOptions.model} />;
  }

  private _chatOptions: Chat.IOptions;
}
