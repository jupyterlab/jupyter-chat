/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand,
  IInputModel
} from '@jupyter/chat';

export class EmojiCommandProvider implements IChatCommandProvider {
  public id: string = 'jupyter-chat:emoji-commands';
  private _slash_commands: ChatCommand[] = [
    {
      name: ':heart:',
      replaceWith: '❤',
      providerId: this.id,
      description: 'Emoji',
      icon: '❤'
    },
    {
      name: ':smile:',
      replaceWith: '🙂',
      providerId: this.id,
      description: 'Emoji',
      icon: '🙂'
    },
    {
      name: ':thinking:',
      replaceWith: '🤔',
      providerId: this.id,
      description: 'Emoji',
      icon: '🤔'
    },
    {
      name: ':cool:',
      replaceWith: '😎',
      providerId: this.id,
      description: 'Emoji',
      icon: '😎'
    }
  ];

  // regex used to test the current word
  private _regex: RegExp = /^:\w*:?/;

  async listCommandCompletions(inputModel: IInputModel) {
    const match = inputModel.currentWord?.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const commands = this._slash_commands.filter(cmd =>
      cmd.name.startsWith(match)
    );
    return commands;
  }

  async onSubmit(inputModel: IInputModel) {
    // this provider only provides commands that replace the current word
    // when typed / selected from the menu. this method does not need to handle
    // anything on submission.
    return;
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
