/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ActiveCellManager,
  buildChatSidebar,
  ChatModel,
  IChatMessage,
  INewMessage,
  SelectionWatcher
} from '@jupyter/chat';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';
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
  optional: [INotebookTracker, IThemeManager],
  activate: (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    notebookTracker: INotebookTracker | null,
    themeManager: IThemeManager | null
  ): void => {
    // Track the current active cell.
    let activeCellManager: ActiveCellManager | null = null;
    if (notebookTracker) {
      activeCellManager = new ActiveCellManager({
        tracker: notebookTracker,
        shell: app.shell
      });
    }

    // Track the current selection.
    const selectionWatcher = new SelectionWatcher({
      shell: app.shell
    });

    const model = new MyChatModel({ activeCellManager, selectionWatcher });
    const panel = buildChatSidebar({ model, rmRegistry, themeManager });
    app.shell.add(panel, 'left');
  }
};

export default [plugin];
