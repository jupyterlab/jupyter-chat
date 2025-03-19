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
import { JSONObject } from '@lumino/coreutils';
import { LabChatModel } from 'jupyterlab-chat';

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

  async getChatCommands(inputModel: IInputModel, chatModel: LabChatModel) {
    this._users.clear();
    const match = inputModel.currentWord?.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    // Get the user list from the chat file.
    Object.values(chatModel.sharedModel.users).forEach(userObject => {
      userObject = userObject as JSONObject;
      if (!userObject.username) {
        return;
      }
      const user = userObject as unknown as IUser;
      const username = (
        user.display_name ??
        user.name ??
        user.username
      ).replace(/ /g, '-');
      this._users.set(`@${username}`, {
        user,
        icon: Avatar({ user: user as User.IIdentity }) ?? undefined
      });
    });

    // Add the users connected to the chat (even if they never sent a message).
    chatModel.sharedModel.awareness.getStates().forEach(value => {
      const user = value.user as IUser;
      if (!user) {
        return;
      }
      const username = (
        user.display_name ??
        user.name ??
        user.username
      ).replace(/ /g, '-');

      this._users.set(`@${username}`, {
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
    inputModel: IInputModel,
    chatModel: LabChatModel
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
}
