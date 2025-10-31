/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { LabIcon } from '@jupyterlab/ui-components';
import type {
  AutocompleteChangeReason,
  AutocompleteProps as GenericAutocompleteProps
} from '@mui/material';
import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { ChatCommand, IChatCommandRegistry } from '../../registers';
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

  // whether the chat commands menu is open.
  // NOTE: every `setOpen(false)` call should be followed by a
  // `setHighlighted(false)` call.
  const [open, setOpen] = useState(false);

  // current list of chat commands matched by the current word.
  // the current word is the space-separated word at the user's cursor.
  const [commands, setCommands] = useState<ChatCommand[]>([]);

  useEffect(() => {
    /**
     * Callback that runs whenever the current word changes.
     */
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

      let commandCompletions: ChatCommand[] = [];
      for (const provider of providers) {
        // TODO: optimize performance when this method is truly async
        try {
          commandCompletions = commandCompletions.concat(
            await provider.listCommandCompletions(inputModel)
          );
        } catch (e) {
          console.error(
            `Error when getting chat commands from command provider '${provider.id}': `,
            e
          );
        }
      }

      // Immediately replace the current word if it exactly matches one command
      // and 'replaceWith' is set.
      if (
        commandCompletions.length === 1 &&
        commandCompletions[0].name === inputModel.currentWord &&
        commandCompletions[0].replaceWith !== undefined
      ) {
        const replacement = commandCompletions[0].replaceWith;
        inputModel.replaceCurrentWord(replacement);
        return;
      }

      // Otherwise, open/close the menu based on the presence of command
      // completions and set the menu entries.
      if (commandCompletions.length) {
        setOpen(true);
      } else {
        setOpen(false);
        setHighlighted(false);
      }
      setCommands(commandCompletions);
    }

    inputModel.currentWordChanged.connect(getCommands);

    return () => {
      inputModel.currentWordChanged.disconnect(getCommands);
    };
  }, [inputModel]);

  /**
   * onChange(): the callback invoked when a command is selected from the chat
   * commands menu. When a command `cmd` is selected, this function replaces the
   * current word with `cmd.replaceWith` if set, `cmd.name` otherwise.
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

    let replacement =
      command.replaceWith === undefined ? command.name : command.replaceWith;
    if (command.spaceOnAccept) {
      replacement += ' ';
    }
    inputModel.replaceCurrentWord(replacement);
  };

  return {
    autocompleteProps: {
      open,
      options: commands,
      getOptionLabel: (command: ChatCommand | string) =>
        typeof command === 'string' ? '' : command.name,
      renderOption: (
        defaultProps,
        command: ChatCommand,
        __: unknown,
        ___: unknown
      ) => {
        const { key, ...listItemProps } = defaultProps;
        const commandIcon: JSX.Element = React.isValidElement(command.icon) ? (
          command.icon
        ) : (
          <span>
            {command.icon instanceof LabIcon ? (
              <command.icon.react />
            ) : (
              command.icon
            )}
          </span>
        );
        return (
          <Box
            key={key}
            component="li"
            {...listItemProps}
            sx={{
              ...((listItemProps as any).sx || {}),
              padding: '4px 8px !important',
              gap: 2
            }}
          >
            {commandIcon}
            <Typography
              variant="body2"
              component="span"
              className="jp-chat-command-name"
            >
              {command.name}
            </Typography>
            {command.description && (
              <>
                <span> - </span>
                <Typography
                  variant="caption"
                  component="span"
                  color="text.secondary"
                >
                  {command.description}
                </Typography>
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
      autoSelect: true,
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
