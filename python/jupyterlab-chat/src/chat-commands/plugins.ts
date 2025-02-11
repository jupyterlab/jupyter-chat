/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { IChatCommandRegistry } from '@jupyter/chat';
import { ChatCommandRegistry } from './registry';

export const chatCommandRegistryPlugin: JupyterFrontEndPlugin<IChatCommandRegistry> =
  {
    id: 'jupyterlab-chat-extension:chatCommandRegistry',
    description:
      'The chat command registry used by the jupyterlab-chat-extension.',
    autoStart: true,
    provides: IChatCommandRegistry,
    activate: app => {
      return new ChatCommandRegistry();
    }
  };
