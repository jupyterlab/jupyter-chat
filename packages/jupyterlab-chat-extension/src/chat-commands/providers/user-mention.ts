/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand,
  IInputModel,
  Avatar,
  IUser
} from '@jupyter/chat';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { User } from '@jupyterlab/services';
import { LabChatContext } from 'jupyterlab-chat';

export const mentionCommandsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:mentionCommandsPlugin',
  description: 'Plugin which adds user mention commands.',
  autoStart: true,
  requires: [IChatCommandRegistry],
  activate: (app, registry: IChatCommandRegistry) => {
    registry.addProvider(new MentionCommandProvider());
  }
};

class MentionCommandProvider implements IChatCommandProvider {
  public id: string = 'jupyter-chat:mention-commands';

  // regex used to test the current word
  private _regex: RegExp = /^@[\w-]*:?/;

  async getChatCommands(inputModel: IInputModel) {
    this._users.clear();
    const match = inputModel.currentWord?.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const users = (inputModel.chatContext as LabChatContext).users;
    users.forEach(user => {
      let mentionName = user.mention_name;
      if (!mentionName) {
        mentionName = Private.getMentionName(user);
        user.mention_name = mentionName;
      }

      this._users.set(mentionName, {
        user,
        icon: Avatar({ user: user as User.IIdentity }) ?? undefined
      });
    });

    // Build the commands for each user.
    const commands: ChatCommand[] = Array.from(this._users)
      .sort()
      .filter(user => user[0].startsWith(match))
      .map(user => {
        return {
          name: user[0],
          providerId: this.id,
          icon: user[1].icon
        };
      });
    return commands;
  }

  async handleChatCommand(
    command: ChatCommand,
    inputModel: IInputModel
  ): Promise<void> {
    inputModel.replaceCurrentWord(`${command.name} `);
    if (this._users.has(command.name)) {
      inputModel.addMention?.(this._users.get(command.name)!.user);
    }
  }

  private _users = new Map<string, Private.CommandUser>();
}

namespace Private {
  export type CommandUser = {
    user: IUser;
    icon?: JSX.Element;
  };

  /**
   * Build the mention name from a User object.
   */
  export function getMentionName(user: IUser): string {
    const username = (user.display_name ?? user.name ?? user.username).replace(
      / /g,
      '-'
    );
    return `@${username}`;
  }
}
