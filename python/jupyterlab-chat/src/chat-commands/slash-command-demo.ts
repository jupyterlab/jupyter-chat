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

export class SlashCommandProvider implements IChatCommandProvider {
  public id: string = 'jai-slash-commands';
  private _slash_commands: ChatCommand[] = [
    { name: '/ask', providerId: this.id, replaceWith: '/ask ' },
    { name: '/learn', providerId: this.id, replaceWith: '/learn ' },
    { name: '/help', providerId: this.id, replaceWith: '/help ' }
  ];

  // regex used to test the current word
  private _regex: RegExp = /^\s*\/\w*$/;

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

export const slashCommandDemoPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:slashCommandDemoPlugin',
  description:
    'A demo plugin which adds Jupyter AI slash commands to the menu. Should be removed after PR review.',
  autoStart: true,
  requires: [IChatCommandRegistry],
  activate: (app, registry: IChatCommandRegistry) => {
    registry.addProvider(new SlashCommandProvider());
  }
};
