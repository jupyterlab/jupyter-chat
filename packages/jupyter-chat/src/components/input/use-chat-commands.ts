/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { useEffect, useState } from 'react';
import { ChatCommand, IChatCommandRegistry } from '../../chat-commands';
import { AutocompleteChangeReason, AutocompleteProps } from '@mui/material';

type UseChatCommandsReturn = {
  autocompleteProps: Omit<AutocompleteProps<any, any, any, any>, 'renderInput'>;
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
  input: string,
  setInput: (newInput: string) => void,
  inputRef: React.MutableRefObject<HTMLInputElement | undefined>,
  chatCommandRegistry?: IChatCommandRegistry
): UseChatCommandsReturn {
  // whether an option is highlighted in the chat commands menu
  const [highlighted, setHighlighted] = useState(false);

  // whether the chat commands menu is open
  const [open, setOpen] = useState(true);

  // current list of chat commands matched by the current word.
  // the current word is the space-separated word at the user's cursor.
  const [commands, setCommands] = useState<ChatCommand[]>([]);

  useEffect(() => {
    async function getCommands() {
      const providers = chatCommandRegistry?.getProviders();
      if (!providers) {
        return;
      }

      let newCommands: ChatCommand[] = [];
      for (const provider of providers) {
        newCommands = newCommands.concat(await provider.getChatCommands(input));
      }

      if (newCommands) {
        setOpen(true);
      }
      setCommands(newCommands);
    }

    getCommands();
  }, [input]);

  return {
    autocompleteProps: {
      open,
      options: commands,
      value: null,
      autoHighlight: true,
      freeSolo: true,
      disableClearable: true,
      onChange: (
        _: unknown,
        command: ChatCommand,
        reason: AutocompleteChangeReason
      ) => {
        if (reason !== 'selectOption') {
          return;
        }
        if (!inputRef.current || !inputRef.current.selectionStart) {
          return;
        }
        if (!chatCommandRegistry) {
          return;
        }

        const cursorIndex = inputRef.current.selectionStart;
        const partialInput = input.slice(0, cursorIndex);
        const setPartialInput = (newPartialInput: string) => {
          setInput(newPartialInput + input.slice(cursorIndex));
        };

        chatCommandRegistry.handleChatCommand(
          command,
          partialInput,
          setPartialInput
        );
      },
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
