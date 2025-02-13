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
    { name: '/help', providerId: this.id, replaceWith: '/help ' },
    {
      name: '/test',
      providerId: this.id,
      replaceWith: 'asdfasdf adf sdf    asdf'
    }
  ];

  /**
   * matches when:
     - any partial slash command appears at start of input
      - the partial slash command is immediately followed by end of input
      
      Examples:
      - "/" => matched
      - "/le" => matched
      - "/learn" => matched
      - "/learn " (note the space) => not matched
      - "what does /help do?" => not matched
    */
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
