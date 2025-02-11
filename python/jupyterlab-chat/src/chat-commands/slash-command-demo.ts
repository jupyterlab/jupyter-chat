import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import {
  IChatCommandProvider,
  IChatCommandRegistry,
  ChatCommand
} from '@jupyter/chat';

// TODO: rename cmd label to cmd name
export class SlashCommandProvider implements IChatCommandProvider {
  public id: string = 'jai-slash-commands';
  private _slash_commands: ChatCommand[] = [
    { label: '/ask', value: '/ask ', providerId: this.id },
    { label: '/learn', value: '/learn ', providerId: this.id },
    { label: '/help', value: '/help ', providerId: this.id }
  ];

  /**
   * matches when:
     - any partial slash command appears at start of input
      - the partial slash command is immediately followed by end of input
      
      Examples:
      - "/" => matched
      - "/le" => matched
      - "/learn" => matched
      - "/learn " (note the space) => not matched
      - "what does /help do?" => not matched
    */
  private _regex: RegExp = /^\s*\/\w*$/;

  /**
   * @param partialInput The **partial input**, i.e. the substring of input up
   * to the user's cursor position.
   */
  async getChatCommands(partialInput: string) {
    const match = partialInput.match(this._regex)?.[0];
    if (!match) {
      return [];
    }

    const commands = this._slash_commands.filter(
      // TODO: fix this
      cmd => (cmd.label ?? cmd.value).startsWith(match) && cmd.value !== match
    );
    return commands;
  }

  async handleChatCommand(
    command: ChatCommand,
    partialInput: string,
    replacePartialInput: (newPartialInput: string) => void
  ): Promise<void> {
    const newPartialInput = partialInput.replace(this._regex, command.value);
    replacePartialInput(newPartialInput);
  }
}

export const slashCommandDemoPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:slashCommandDemoPlugin',
  description:
    'A demo plugin which adds Jupyter AI slash commands to the menu. Should be removed after PR review.',
  autoStart: true,
  requires: [IChatCommandRegistry],
  activate: (app, registry: IChatCommandRegistry) => {
    registry.addProvider(new SlashCommandProvider());
  }
};
