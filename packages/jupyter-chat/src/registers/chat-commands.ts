/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { LabIcon } from '@jupyterlab/ui-components';
import { Token } from '@lumino/coreutils';
import { IInputModel } from '../input-model';

/**
 * The token for the chat command registry, which can be provided by an extension
 * using @jupyter/chat package.
 */
export const IChatCommandRegistry = new Token<IChatCommandRegistry>(
  '@jupyter/chat:IChatCommandRegistry'
);

/**
 * Interface of a chat command registry, which tracks a list of chat command
 * providers. Providers provide a list of commands given a user's partial input,
 * and define how commands are handled when accepted in the chat commands menu.
 */
export interface IChatCommandRegistry {
  addProvider(provider: IChatCommandProvider): void;
  getProviders(): IChatCommandProvider[];

  /**
   * Handles a chat command by calling `handleChatCommand()` on the provider
   * corresponding to this chat command.
   */
  handleChatCommand(command: ChatCommand, inputModel: IInputModel): void;
}

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
  icon?: LabIcon | JSX.Element | string | null;

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
   * Async function which accepts the input model and returns a list of
   * valid chat commands that match the current word. The current word is
   * space-separated word at the user's cursor.
   */
  getChatCommands(inputModel: IInputModel): Promise<ChatCommand[]>;

  /**
   * Function called when a chat command is run by the user through the chat
   * commands menu.
   */
  handleChatCommand(
    command: ChatCommand,
    inputModel: IInputModel
  ): Promise<void>;
}

/**
 * Default chat command registry implementation.
 */
export class ChatCommandRegistry implements IChatCommandRegistry {
  constructor() {
    this._providers = new Map<string, IChatCommandProvider>();
  }

  addProvider(provider: IChatCommandProvider): void {
    this._providers.set(provider.id, provider);
  }

  getProviders(): IChatCommandProvider[] {
    return Array.from(this._providers.values());
  }

  handleChatCommand(command: ChatCommand, inputModel: IInputModel) {
    const provider = this._providers.get(command.providerId);
    if (!provider) {
      console.error(
        'Error in handling chat command: No command provider has an ID of ' +
          command.providerId
      );
      return;
    }

    provider.handleChatCommand(command, inputModel);
  }

  private _providers: Map<string, IChatCommandProvider>;
}
