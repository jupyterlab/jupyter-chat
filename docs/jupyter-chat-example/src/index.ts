/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  buildChatSidebar,
  ChatModel,
  IChatMessage,
  INewMessage
} from '@jupyter/chat';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { UUID } from '@lumino/coreutils';

class MyChatModel extends ChatModel {
  sendMessage(
    newMessage: INewMessage
  ): Promise<boolean | void> | boolean | void {
    console.log(`New Message:\n${newMessage.body}`);
    const message: IChatMessage = {
      body: newMessage.body,
      id: newMessage.id ?? UUID.uuid4(),
      type: 'msg',
      time: Date.now() / 1000,
      sender: { username: 'me' }
    };
    this.messageAdded(message);
  }
}

/*
 * Extension providing a chat panel.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-chat-example:plugin',
  description: 'The chat panel widget.',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [IThemeManager],
  activate: (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    themeManager: IThemeManager | null
  ): void => {
    const model = new MyChatModel({});
    const panel = buildChatSidebar({ model, rmRegistry });
    app.shell.add(panel, 'left');
  }
};

export default [plugin];
