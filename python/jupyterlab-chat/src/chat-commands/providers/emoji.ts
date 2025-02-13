/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand
} from '@jupyter/chat';

export class EmojiCommandProvider implements IChatCommandProvider {
  public id: string = 'jupyter-chat:emoji-commands';
  private _slash_commands: ChatCommand[] = [
    { name: ':heart:', replaceWith: '❤️', providerId: this.id },
    { name: ':smile:', replaceWith: '🙂', providerId: this.id },
    { name: ':thinking:', replaceWith: '🤔', providerId: this.id },
    { name: ':cool:', replaceWith: '😎', providerId: this.id }
  ];

  // regex used to test the current word
  private _regex: RegExp = /:\w*:?/;

  async getChatCommands(currentWord: string) {
    const match = currentWord.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const commands = this._slash_commands.filter(cmd =>
      cmd.name.startsWith(match)
    );
    return commands;
  }

  async handleChatCommand(
    command: ChatCommand,
    currentWord: string,
    replaceCurrentWord: (newWord: string) => void
  ): Promise<void> {
    if (!command.replaceWith) {
      return;
    }

    replaceCurrentWord(command.replaceWith);
  }
}

export const emojiCommandsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:emojiCommandsPlugin',
  description: 'Plugin which adds emoji commands to the chat.',
  autoStart: true,
  requires: [IChatCommandRegistry],
  activate: (app, registry: IChatCommandRegistry) => {
    registry.addProvider(new EmojiCommandProvider());
  }
};
