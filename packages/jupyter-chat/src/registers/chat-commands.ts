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
  /**
   * Adds a chat command provider to the registry.
   */
  addProvider(provider: IChatCommandProvider): void;

  /**
   * Lists all chat command providers previously added via `addProvider()`.
   */
  getProviders(): IChatCommandProvider[];

  /**
   * Calls `onSubmit()` on each command provider in serial. Each command
   * provider's `onSubmit()` method is responsible for checking the entire input
   * for command calls and handling them accordingly.
   *
   * This method is called by the application after the user presses the "Send"
   * button but before the message is sent to server.
   */
  onSubmit(inputModel: IInputModel): Promise<void>;
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
   * If set, Jupyter Chat will replace the current word with this string immediately when
   * the command is accepted from the chat commands menu or the current word
   * matches the command's `name` exactly.
   *
   * This is generally used by "shortcut command" providers, e.g. the emoji
   * command provider.
   */
  replaceWith?: string;

  /**
   * Specifies whether the application should add a space ' ' after the command
   * is accepted from the menu.
   *
   * Defaults to `false`.
   */
  spaceOnAccept?: boolean;
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
   * A method that should return the list of valid chat commands whose names
   * complete the current word.
   *
   * The current word should be accessed from `inputModel.currentWord`.
   */
  listCommandCompletions(inputModel: IInputModel): Promise<ChatCommand[]>;

  /**
   * A method that should identify and handle *all* command calls within a
   * message that the user intends to submit. This method is called after a user
   * presses the "Send" button but before the message is sent to the server.
   *
   * The entire message should be read from `inputModel.value`. This method may
   * modify the new message before submission by setting `inputModel.value` or
   * by calling other methods available on `inputModel`.
   */
  onSubmit(inputModel: IInputModel): Promise<void>;
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

  async onSubmit(inputModel: IInputModel) {
    for (const provider of this._providers.values()) {
      await provider.onSubmit(inputModel);
    }
  }

  private _providers: Map<string, IChatCommandProvider>;
}
