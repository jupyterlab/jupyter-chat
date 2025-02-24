/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { LabIcon } from '@jupyterlab/ui-components';

export type ChatCommand = {
  /**
   * The name of the command. This defines what the user should type in the
   * input to have the command appear in the chat commands menu.
   */
  name: string;

  /**
   * ID of the provider the command originated from.
   */
  providerId: string;

  /**
   * If set, this will be rendered as the icon for the command in the chat
   * commands menu. Jupyter Chat will choose a default if this is unset.
   */
  icon?: LabIcon | string;

  /**
   * If set, this will be rendered as the description for the command in the
   * chat commands menu. Jupyter Chat will choose a default if this is unset.
   */
  description?: string;

  /**
   * If set, Jupyter Chat will replace the current word with this string after
   * the command is run from the chat commands menu.
   *
   * If all commands from a provider have this property set, then
   * `handleChatCommands()` can just return on the first line.
   */
  replaceWith?: string;
};

/**
 * Interface of a command provider.
 */
export interface IChatCommandProvider {
  /**
   * ID of this command provider.
   */
  id: string;

  /**
   * Async function which accepts the current word and returns a list of
   * valid chat commands that match the current word. The current word is
   * space-separated word at the user's cursor.
   *
   * TODO: Pass a ChatModel/InputModel instance here to give the command access
   * to more than the current word.
   */
  getChatCommands(currentWord: string): Promise<ChatCommand[]>;

  /**
   * Function called when a chat command is run by the user through the chat
   * commands menu.
   *
   * TODO: Pass a ChatModel/InputModel instance here to provide a function to
   * replace the current word.
   */
  handleChatCommand(
    command: ChatCommand,
    currentWord: string,
    replaceCurrentWord: (newWord: string) => void
  ): Promise<void>;
}
