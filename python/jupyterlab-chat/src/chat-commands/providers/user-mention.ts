/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand,
  IInputModel,
  Avatar
} from '@jupyter/chat';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { User } from '@jupyterlab/services';
import { LabChatModel } from 'jupyterlab-chat';
import { JSONObject } from '@lumino/coreutils';

export class MentionCommandProvider implements IChatCommandProvider {
  public id: string = 'jupyter-chat:mention-commands';

  // regex used to test the current word
  private _regex: RegExp = /^@[\w-]*:?/;

  async getChatCommands(inputModel: IInputModel, chatModel: LabChatModel) {
    const match = inputModel.currentWord?.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const icons: { [user: string]: JSX.Element | undefined } = {};
    // Get the user list from the chat file.
    const users = Object.values(chatModel.sharedModel.users).map(user => {
      user = user as JSONObject;
      const username = (user.display_name ??
        user.name ??
        user.username) as string;
      icons[username] = Avatar({ user: user as User.IIdentity }) ?? undefined;
      return username;
    });

    // Add the users connected to the chat (even if they never sent a message).
    chatModel.sharedModel.awareness.getStates().forEach(value => {
      const user = value.user;
      if (!user) {
        return;
      }
      const username = (user.display_name ??
        user.name ??
        user.username) as string;
      if (username && !users.includes(username)) {
        icons[username] = Avatar({ user: user as User.IIdentity }) ?? undefined;
        users.push(username);
      }
    });

    // Build the commands for each user.
    const commands: ChatCommand[] = users
      .sort()
      .filter(user => `@${user.replace(/ /g, '-')}`.startsWith(match))
      .map(user => {
        return {
          name: `@${user.replace(/ /g, '-')}`,
          replaceWith: `@${user}`,
          providerId: this.id,
          icon: icons[user]
        };
      });
    return commands;
  }

  async handleChatCommand(
    command: ChatCommand,
    inputModel: IInputModel,
    chatModel: LabChatModel
  ): Promise<void> {
    // no handling needed because `replaceWith` is set in each command.
    return;
  }
}

export const mentionCommandsPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:mentionCommandsPlugin',
  description: 'Plugin which adds user mention commands.',
  autoStart: true,
  requires: [IChatCommandRegistry],
  activate: (app, registry: IChatCommandRegistry) => {
    registry.addProvider(new MentionCommandProvider());
  }
};
