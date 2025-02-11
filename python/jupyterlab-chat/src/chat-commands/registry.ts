/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatCommand,
  IChatCommandRegistry,
  IChatCommandProvider
} from '@jupyter/chat';

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
    partialInput: string,
    setPartialInput: (newPartialInput: string) => void
  ) {
    const provider = this._providers.get(command.providerId);
    if (!provider) {
      console.error(
        'Error in handling chat command: No command provider has an ID of ' +
          command.providerId
      );
      return;
    }

    provider.handleChatCommand(command, partialInput, setPartialInput);
  }

  private _providers: Map<string, IChatCommandProvider>;
}
