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

  /**
   * Regex that matches all mentions in a message. The first capturing group
   * contains the mention name of the mentioned user.
   *
   * IMPORTANT: the 'g' flag must be set to return multiple `@`-mentions when
   * parsing the entire input `inputModel.value`.
   */
  private _regex: RegExp = /@([\w-]*)/g;

  /**
   * Lists all valid user mentions that complete the current word.
   */
  async listCommandCompletions(inputModel: IInputModel) {
    const { currentWord } = inputModel;
    if (!currentWord) {
      return [];
    }

    // Get current mention, which will always be the first captured group in the
    // first match.
    // `matchAll()` is used here because `match()` does not return captured
    // groups when the regex is global.
    const currentMention = Array.from(
      currentWord.matchAll(this._regex)
    )?.[0]?.[1];

    // Return early if no user is currently mentioned
    if (currentMention === undefined || currentMention === null) {
      return [];
    }

    // Otherwise, build the list of users that complete `currentMention`, and
    // return them as command completions
    const existingMentions = this._getExistingMentions(inputModel);
    const commands: ChatCommand[] = Array.from(this._getUsers(inputModel))
      // remove users whose mention names that do not complete the match
      .filter(user =>
        user[0].toLowerCase().startsWith(currentMention.toLowerCase())
      )
      // remove users already mentioned in the message
      .filter(user => !existingMentions.has(user[0]))
      .map(user => {
        return {
          name: '@' + user[0],
          providerId: this.id,
          icon: user[1].icon,
          spaceOnAccept: true
        };
      });

    return commands;
  }

  /**
   * Returns the set of mention names that have already been @-mentioned in the
   * input.
   */
  _getExistingMentions(inputModel: IInputModel): Set<string> {
    const matches = inputModel.value?.matchAll(this._regex);
    const existingMentions = new Set<string>();
    for (const match of matches) {
      const mention = match?.[1];
      // ignore if 1st group capturing the mention name is an empty string
      if (!mention) {
        continue;
      }
      existingMentions.add(mention);
    }

    return existingMentions;
  }

  /**
   * Adds all users identified via `@` as mentions to the new message
   * immediately prior to submission.
   */
  async onSubmit(inputModel: IInputModel) {
    const input = inputModel.value;
    const matches = input.matchAll(this._regex);

    for (const match of matches) {
      const mention = match?.[1];
      if (!mention) {
        continue;
      }

      const mentionedUser = this._getUsers(inputModel).get(mention);
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
    // chatContext should be of type `LabChatContext`, so `users` should be of
    // type `LabChatUser[]`, where `mention_name` is always defined.
    const userList = inputModel.chatContext.users;
    const currentUser = (inputModel.chatContext as any)._model?.user;
    
    userList.forEach(user => {
      // Skip the current user
      if (currentUser && user.username === currentUser.username) {
        return;
      }
      
      if (!user.mention_name) {
        console.error(
          `No 'mention_name' property for user '${user.username}'. ` +
            'This user is being omitted from ' +
            "'MentionCommandProvider._getUsers()'."
        );
        return;
      }
      users.set(user.mention_name, {
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
}
