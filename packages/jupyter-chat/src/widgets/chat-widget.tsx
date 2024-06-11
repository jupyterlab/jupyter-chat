/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IThemeManager, ReactWidget } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
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

    this._model = options.model;
    this._themeManager = options?.themeManager || null;
    this._rmRegistry = options.rmRegistry;
  }

  /**
   * Get the model of the widget.
   */
  get model(): IChatModel {
    return this._model;
  }

  render() {
    return (
      <Chat
        model={this._model}
        themeManager={this._themeManager}
        rmRegistry={this._rmRegistry}
      />
    );
  }

  private readonly _model: IChatModel;
  private _themeManager: IThemeManager | null;
  private _rmRegistry: IRenderMimeRegistry;
}

export namespace ChatWidget {
  export interface IOptions extends Chat.IOptions {}
}
