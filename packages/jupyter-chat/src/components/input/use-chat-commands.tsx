/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React from 'react';
import { useEffect, useState } from 'react';
import type {
  AutocompleteChangeReason,
  AutocompleteProps as GenericAutocompleteProps
} from '@mui/material';
import { Box } from '@mui/material';

import { ChatCommand, IChatCommandRegistry } from '../../chat-commands';
import { IInputModel } from '../../input-model';

type AutocompleteProps = GenericAutocompleteProps<any, any, any, any>;

type UseChatCommandsReturn = {
  autocompleteProps: Omit<AutocompleteProps, 'renderInput'>;
  menu: {
    open: boolean;
    highlighted: boolean;
  };
};

/**
 * A hook which automatically returns the list of command options given the
 * current input and chat command registry.
 *
 * Intended usage: `const chatCommands = useChatCommands(...)`.
 */
export function useChatCommands(
  inputModel: IInputModel,
  chatCommandRegistry?: IChatCommandRegistry
): UseChatCommandsReturn {
  // whether an option is highlighted in the chat commands menu
  const [highlighted, setHighlighted] = useState(false);

  // whether the chat commands menu is open
  const [open, setOpen] = useState(false);

  // current list of chat commands matched by the current word.
  // the current word is the space-separated word at the user's cursor.
  const [commands, setCommands] = useState<ChatCommand[]>([]);

  useEffect(() => {
    async function getCommands(_: IInputModel, currentWord: string | null) {
      const providers = chatCommandRegistry?.getProviders();
      if (!providers) {
        return;
      }

      if (!currentWord?.length) {
        setCommands([]);
        setOpen(false);
        setHighlighted(false);
        return;
      }

      let newCommands: ChatCommand[] = [];
      for (const provider of providers) {
        // TODO: optimize performance when this method is truly async
        try {
          newCommands = newCommands.concat(
            await provider.getChatCommands(inputModel)
          );
        } catch (e) {
          console.error(
            `Error when getting chat commands from command provider '${provider.id}': `,
            e
          );
        }
      }
      if (newCommands) {
        setOpen(true);
      }
      setCommands(newCommands);
    }

    inputModel.currentWordChanged.connect(getCommands);

    return () => {
      inputModel.currentWordChanged.disconnect(getCommands);
    };
  }, [inputModel]);

  /**
   * onChange(): the callback invoked when a command is selected from the chat
   * commands menu by the user.
   */
  const onChange: AutocompleteProps['onChange'] = (
    e: unknown,
    command: ChatCommand,
    reason: AutocompleteChangeReason
  ) => {
    if (reason !== 'selectOption') {
      // only call this callback when a command is selected by the user. this
      // requires `reason === 'selectOption'`.
      return;
    }

    if (!chatCommandRegistry) {
      return;
    }

    const currentWord = inputModel.currentWord;
    if (!currentWord) {
      return;
    }

    // if replaceWith is set, handle the command immediately
    if (command.replaceWith) {
      inputModel.replaceCurrentWord(command.replaceWith);
      return;
    }

    // otherwise, defer handling to the command provider
    chatCommandRegistry.handleChatCommand(command, inputModel);
  };

  return {
    autocompleteProps: {
      open,
      options: commands,
      getOptionLabel: (command: ChatCommand) => command.name,
      renderOption: (
        defaultProps,
        command: ChatCommand,
        __: unknown,
        ___: unknown
      ) => {
        const { key, ...listItemProps } = defaultProps;
        const commandIcon: JSX.Element = (
          <span>
            {typeof command.icon === 'object' ? (
              <command.icon.react />
            ) : (
              command.icon
            )}
          </span>
        );
        return (
          <Box key={key} component="li" {...listItemProps}>
            {commandIcon}
            <p className="jp-chat-command-name">{command.name}</p>
            {command.description && (
              <>
                <span> - </span>
                <p className="jp-chat-command-description">
                  {command.description}
                </p>
              </>
            )}
          </Box>
        );
      },
      // always show all options, since command providers should exclusively
      // define what commands are added to the menu.
      filterOptions: (commands: ChatCommand[]) => commands,
      value: null,
      autoHighlight: true,
      freeSolo: true,
      disableClearable: true,
      onChange,
      onHighlightChange:
        /**
         * On highlight change: set `highlighted` to whether an option is
         * highlighted by the user.
         *
         * This isn't called when an option is selected for some reason, so we
         * need to call `setHighlighted(false)` in `onClose()`.
         */
        (_, highlightedOption) => {
          setHighlighted(!!highlightedOption);
        },
      onClose:
        /**
         * On close: set `highlighted` to `false` and close the popup by
         * setting `open` to `false`.
         */
        () => {
          setHighlighted(false);
          setOpen(false);
        }
    },
    menu: {
      open,
      highlighted
    }
  };
}
