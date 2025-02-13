/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useEffect, useRef, useState } from 'react';

import {
  Autocomplete,
  Box,
  InputAdornment,
  SxProps,
  TextField,
  Theme
} from '@mui/material';
import clsx from 'clsx';

import { CancelButton } from './input/cancel-button';
import { SendButton } from './input/send-button';
import { IChatModel } from '../model';
import { IAutocompletionRegistry } from '../registry';
import { IConfig, Selection } from '../types';
import { useChatCommands } from './input/use-chat-commands';
import { IChatCommandRegistry } from '../chat-commands';

const INPUT_BOX_CLASS = 'jp-chat-input-container';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { model } = props;
  const [input, setInput] = useState<string>(props.value || '');
  const inputRef = useRef<HTMLInputElement>();

  const chatCommands = useChatCommands(
    input,
    setInput,
    inputRef,
    props.chatCommandRegistry
  );

  const [sendWithShiftEnter, setSendWithShiftEnter] = useState<boolean>(
    model.config.sendWithShiftEnter ?? false
  );
  const [typingNotification, setTypingNotification] = useState<boolean>(
    model.config.sendTypingNotification ?? false
  );

  // Display the include selection menu if it is not explicitly hidden, and if at least
  // one of the tool to check for text or cell selection is enabled.
  let hideIncludeSelection = props.hideIncludeSelection ?? false;
  if (model.activeCellManager === null && model.selectionWatcher === null) {
    hideIncludeSelection = true;
  }

  useEffect(() => {
    const configChanged = (_: IChatModel, config: IConfig) => {
      setSendWithShiftEnter(config.sendWithShiftEnter ?? false);
      setTypingNotification(config.sendTypingNotification ?? false);
    };
    model.configChanged.connect(configChanged);

    const focusInputElement = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    model.focusInputSignal?.connect(focusInputElement);

    return () => {
      model.configChanged?.disconnect(configChanged);
      model.focusInputSignal?.disconnect(focusInputElement);
    };
  }, [model]);

  const inputExists = !!input.trim();

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      ['ArrowDown', 'ArrowUp'].includes(event.key) &&
      !chatCommands.menu.open
    ) {
      event.stopPropagation();
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    // Do not send the message if the user was selecting a suggested command from the
    // Autocomplete component.
    if (chatCommands.menu.highlighted) {
      return;
    }

    // Do not send empty messages, and avoid adding new line in empty message.
    if (!inputExists) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    if (
      (sendWithShiftEnter && event.shiftKey) ||
      (!sendWithShiftEnter && !event.shiftKey)
    ) {
      onSend();
      event.stopPropagation();
      event.preventDefault();
    }
  }

  /**
   * Triggered when sending the message.
   *
   * Add code block if cell or text is selected.
   */
  function onSend(selection?: Selection) {
    let content = input;
    if (selection) {
      content += `

\`\`\`
${selection.source}
\`\`\`
`;
    }
    props.onSend(content);
    setInput('');
  }

  /**
   * Triggered when cancelling edition.
   */
  function onCancel() {
    setInput(props.value || '');
    props.onCancel!();
  }

  // Set the helper text based on whether Shift+Enter is used for sending.
  const helperText = sendWithShiftEnter ? (
    <span>
      Press <b>Shift</b>+<b>Enter</b> to send message
    </span>
  ) : (
    <span>
      Press <b>Shift</b>+<b>Enter</b> to add a new line
    </span>
  );

  return (
    <Box sx={props.sx} className={clsx(INPUT_BOX_CLASS)}>
      <Autocomplete
        {...chatCommands.autocompleteProps}
        // ensure the autocomplete popup always renders on top
        componentsProps={{
          popper: {
            placement: 'top'
          },
          paper: {
            sx: {
              border: '1px solid lightgray'
            }
          }
        }}
        ListboxProps={{
          sx: {
            '& .MuiAutocomplete-option': {
              padding: 2
            }
          }
        }}
        renderInput={params => (
          <TextField
            {...params}
            fullWidth
            variant="outlined"
            multiline
            onKeyDown={handleKeyDown}
            placeholder="Start chatting"
            inputRef={inputRef}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <InputAdornment position="end">
                  {props.onCancel && <CancelButton onCancel={onCancel} />}
                  <SendButton
                    model={model}
                    sendWithShiftEnter={sendWithShiftEnter}
                    inputExists={inputExists}
                    onSend={onSend}
                    hideIncludeSelection={hideIncludeSelection}
                    hasButtonOnLeft={!!props.onCancel}
                  />
                </InputAdornment>
              )
            }}
            FormHelperTextProps={{
              sx: { marginLeft: 'auto', marginRight: 0 }
            }}
            helperText={input.length > 2 ? helperText : ' '}
          />
        )}
        inputValue={input}
        onInputChange={(_, newValue: string) => {
          setInput(newValue);
          if (typingNotification && model.inputChanged) {
            model.inputChanged(newValue);
          }
        }}
      />
    </Box>
  );
}

/**
 * The chat input namespace.
 */
export namespace ChatInput {
  /**
   * The properties of the react element.
   */
  export interface IProps {
    /**
     * The chat model.
     */
    model: IChatModel;
    /**
     * The initial value of the input (default to '')
     */
    value?: string;
    /**
     * The function to be called to send the message.
     */
    onSend: (input: string) => unknown;
    /**
     * The function to be called to cancel editing.
     */
    onCancel?: () => unknown;
    /**
     * Whether to allow or not including selection.
     */
    hideIncludeSelection?: boolean;
    /**
     * Custom mui/material styles.
     */
    sx?: SxProps<Theme>;
    /**
     * Autocompletion properties.
     */
    autocompletionRegistry?: IAutocompletionRegistry;
    /**
     * Autocompletion name.
     */
    autocompletionName?: string;
    /**
     * Chat command registry.
     */
    chatCommandRegistry?: IChatCommandRegistry;
  }
}
