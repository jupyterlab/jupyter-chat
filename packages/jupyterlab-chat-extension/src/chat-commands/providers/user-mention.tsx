/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React from 'react';
import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand,
  IInputModel,
  Avatar,
  IUser
} from '@jupyter/chat';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';

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

  // Regex used to find all mentions in a message.
  // IMPORTANT: the global flag must be specified to find >1 mentions.
  private _regex: RegExp = /@[\w-]*:?/g;

  /**
   * Lists all valid user mentions that complete the current word.
   */
  async listCommandCompletions(inputModel: IInputModel) {
    const match = inputModel.currentWord?.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    // Build the commands for each user.
    const commands: ChatCommand[] = Array.from(this._getUsers(inputModel))
      .sort()
      .filter(user => user[0].toLowerCase().startsWith(match.toLowerCase()))
      .map(user => {
        return {
          name: user[0],
          providerId: this.id,
          icon: user[1].icon,
          spaceOnAccept: true
        };
      });

    return commands;
  }

  /**
   * Adds all users identified via `@` as mentions to the new message prior to
   * submission.
   */
  async onSubmit(inputModel: IInputModel) {
    const input = inputModel.value;
    const matches = input.match(this._regex) ?? [];

    for (const match of matches) {
      const mentionedUser = this._getUsers(inputModel).get(match);
      if (mentionedUser) {
        inputModel.addMention?.(mentionedUser.user);
      }
    }
  }

  /**
   * Returns a dictionary of `{ user: IUser, icon: JSX.Element }` entries, keyed
   * by the user's mention name.
   */
  _getUsers(inputModel: IInputModel): Map<string, Private.CommandUser> {
    const users = new Map();
    const userList = inputModel.chatContext.users;
    userList.forEach(user => {
      let mentionName = user.mention_name;
      if (!mentionName) {
        mentionName = Private.getMentionName(user);
        user.mention_name = mentionName;
      }

      users.set(mentionName, {
        user,
        icon: <Avatar user={user} />
      });
    });

    return users;
  }
}

namespace Private {
  export type CommandUser = {
    user: IUser;
    icon: JSX.Element | null;
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
