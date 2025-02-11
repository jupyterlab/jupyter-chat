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

// TODO: rename cmd label to cmd name
export class EmojiCommandProvider implements IChatCommandProvider {
  public id: string = 'jupyter-chat:emoji-commands';
  private _slash_commands: ChatCommand[] = [
    { label: ':heart:', value: '❤️', providerId: this.id },
    { label: ':smile:', value: '🙂', providerId: this.id },
    { label: ':thinking:', value: '🤔', providerId: this.id },
    { label: ':cool:', value: '😎', providerId: this.id }
  ];
  private _regex: RegExp = /(^|\s+):\w*$/;

  /**
   * @param partialInput The **partial input**, i.e. the substring of input up
   * to the user's cursor position.
   */
  async getChatCommands(partialInput: string) {
    const match = partialInput.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const commands = this._slash_commands.filter(
      // TODO: fix this
      cmd => (cmd.label ?? cmd.value).startsWith(match) && cmd.value !== match
    );
    return commands;
  }

  async handleChatCommand(
    command: ChatCommand,
    partialInput: string,
    replacePartialInput: (newPartialInput: string) => void
  ): Promise<void> {
    const newPartialInput = partialInput.replace(this._regex, command.value);
    replacePartialInput(newPartialInput);
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
