/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Token } from '@lumino/coreutils';
import { ChatCommand, IChatCommandProvider } from './types';

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
  handleChatCommand(
    command: ChatCommand,
    currentWord: string,
    replaceCurrentWord: (newWord: string) => void
  ): void;
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

  handleChatCommand(
    command: ChatCommand,
    currentWord: string,
    replaceCurrentWord: (newWord: string) => void
  ) {
    const provider = this._providers.get(command.providerId);
    if (!provider) {
      console.error(
        'Error in handling chat command: No command provider has an ID of ' +
          command.providerId
      );
      return;
    }

    provider.handleChatCommand(command, currentWord, replaceCurrentWord);
  }

  private _providers: Map<string, IChatCommandProvider>;
}

export const IChatCommandRegistry = new Token<IChatCommandRegistry>(
  '@jupyter/chat:IChatCommandRegistry'
);
