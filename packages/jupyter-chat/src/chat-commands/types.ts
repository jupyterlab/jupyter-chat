import { LabIcon } from '@jupyterlab/ui-components';

export type ChatCommand = {
  // the full command, e.g. "/help".
  value: string;

  // ID of the provider this chat command originated from
  providerId: string;

  // if set, use this as the primary label shown in the chat commands menu.
  // otherwise use `value`.
  label?: string;

  // if set, show this as a secondary subtitle in the chat commands menu.
  description?: string;

  // identifies which icon should be used, if any.
  // Jupyter Chat should choose a default if one is not provided.
  icon?: LabIcon;
};

export interface IChatCommandProvider {
  /**
   * ID of this command provider.
   */
  id: string;

  ready?: Promise<void>;

  /**
   * Async function which accepts a partial command input and returns a list of
   * valid chat commands. Partial command inputs are matched by the `regex`
   * defined by an implementation.
   */
  getChatCommands(partialInput: string): Promise<ChatCommand[]>;

  /**
   * Function called when a chat command is typed by the user, either via
   * accepting a completion or via keyboard.
   */
  handleChatCommand(
    command: ChatCommand,
    partialInput: string,
    replacePartialInput: (newPartialInput: string) => void
  ): Promise<void>;
}
