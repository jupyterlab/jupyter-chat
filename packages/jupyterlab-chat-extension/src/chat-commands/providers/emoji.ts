/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand,
  IInputModel
} from '@jupyter/chat';

const TRANSLATION_DOMAIN = 'jupyterlab_chat';

export class EmojiCommandProvider implements IChatCommandProvider {
  constructor(translator?: ITranslator) {
    const trans = (translator ?? nullTranslator).load(TRANSLATION_DOMAIN);
    this._trans = trans;
  }

  public id: string = 'jupyter-chat:emoji-commands';

  private _getSlashCommands(): ChatCommand[] {
    return [
      {
        name: ':heart:',
        replaceWith: '❤',
        providerId: this.id,
        description: this._trans.__('Emoji'),
        icon: '❤'
      },
      {
        name: ':smile:',
        replaceWith: '🙂',
        providerId: this.id,
        description: this._trans.__('Emoji'),
        icon: '🙂'
      },
      {
        name: ':thinking:',
        replaceWith: '🤔',
        providerId: this.id,
        description: this._trans.__('Emoji'),
        icon: '🤔'
      },
      {
        name: ':cool:',
        replaceWith: '😎',
        providerId: this.id,
        description: this._trans.__('Emoji'),
        icon: '😎'
      }
    ];
  }

  // regex used to test the current word
  private _regex: RegExp = /^:\w*:?/;

  async listCommandCompletions(inputModel: IInputModel) {
    const match = inputModel.currentWord?.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const commands = this._getSlashCommands().filter(cmd =>
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

  private _trans: TranslationBundle;
}

export const emojiCommandsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:emojiCommandsPlugin',
  description: 'Plugin which adds emoji commands to the chat.',
  autoStart: true,
  requires: [IChatCommandRegistry],
  optional: [ITranslator],
  activate: (
    app,
    registry: IChatCommandRegistry,
    translator: ITranslator | null
  ) => {
    registry.addProvider(new EmojiCommandProvider(translator ?? undefined));
  }
};
