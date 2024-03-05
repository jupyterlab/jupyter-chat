import { IThemeManager, ReactWidget } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React from 'react';

import { Chat } from '../components/chat';
import { chatIcon } from '../icons';
import { IChatModel } from '../model';

export class ChatWidget extends ReactWidget {
  constructor(options: ChatWidget.IOptions) {
    super();

    this.id = 'jupyter-chat::widget';
    this.title.icon = chatIcon;
    this.title.caption = 'Jupyter Chat'; // TODO: i18n

    this._chatModel = options.chatModel;
    this._themeManager = options.themeManager;
    this._rmRegistry = options.rmRegistry;
  }

  render() {
    return (
      <Chat
        chatModel={this._chatModel}
        themeManager={this._themeManager}
        rmRegistry={this._rmRegistry}
      />
    );
  }

  private _chatModel: IChatModel;
  private _themeManager: IThemeManager | null;
  private _rmRegistry: IRenderMimeRegistry;
}

export namespace ChatWidget {
  export interface IOptions {
    chatModel: IChatModel;
    themeManager: IThemeManager | null;
    rmRegistry: IRenderMimeRegistry;
  }
}
