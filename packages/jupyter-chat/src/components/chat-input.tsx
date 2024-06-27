/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useEffect, useRef, useState } from 'react';

import {
  Autocomplete,
  Box,
  IconButton,
  InputAdornment,
  SxProps,
  TextField,
  Theme
} from '@mui/material';
import { Send, Cancel } from '@mui/icons-material';
import clsx from 'clsx';
import { AutocompleteCommand, IAutocompletionCommandsProps } from '../types';
import { IAutocompletionRegistry } from '../registry';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const SEND_BUTTON_CLASS = 'jp-chat-send-button';
const CANCEL_BUTTON_CLASS = 'jp-chat-cancel-button';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { autocompletionName, autocompletionRegistry, sendWithShiftEnter } =
    props;
  const autocompletion = useRef<IAutocompletionCommandsProps>();
  const [input, setInput] = useState<string>(props.value || '');

  // The autocomplete commands options.
  const [commandOptions, setCommandOptions] = useState<AutocompleteCommand[]>(
    []
  );
  // whether any option is highlighted in the slash command autocomplete
  const [highlighted, setHighlighted] = useState<boolean>(false);
  // controls whether the slash command autocomplete is open
  const [open, setOpen] = useState<boolean>(false);

  /**
   * Effect: fetch the list of available autocomplete commands.
   */
  useEffect(() => {
    if (autocompletionRegistry === undefined) {
      return;
    }
    autocompletion.current = autocompletionName
      ? autocompletionRegistry.get(autocompletionName)
      : autocompletionRegistry.getDefaultCompletion();

    if (autocompletion.current === undefined) {
      return;
    }

    if (Array.isArray(autocompletion.current.commands)) {
      setCommandOptions(autocompletion.current.commands);
    } else if (typeof autocompletion.current.commands === 'function') {
      autocompletion.current
        .commands()
        .then((commands: AutocompleteCommand[]) => {
          setCommandOptions(commands);
        });
    }
  }, []);

  /**
   * Effect: Open the autocomplete when the user types the 'opener' string into an
   * empty chat input. Close the autocomplete and reset the last selected value when
   * the user clears the chat input.
   */
  useEffect(() => {
    if (!autocompletion.current?.opener) {
      return;
    }

    if (input === autocompletion.current?.opener) {
      setOpen(true);
      return;
    }

    if (input === '') {
      setOpen(false);
      return;
    }
  }, [input]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    // do not send the message if the user was selecting a suggested command from the
    // Autocomplete component.
    if (highlighted) {
      return;
    }

    if (
      event.key === 'Enter' &&
      ((sendWithShiftEnter && event.shiftKey) ||
        (!sendWithShiftEnter && !event.shiftKey))
    ) {
      onSend();
      event.stopPropagation();
      event.preventDefault();
    }
  }

  /**
   * Triggered when sending the message.
   */
  function onSend() {
    setInput('');
    props.onSend(input);
  }

  /**
   * Triggered when cancelling edition.
   */
  function onCancel() {
    setInput(props.value || '');
    props.onCancel!();
  }

  // Set the helper text based on whether Shift+Enter is used for sending.
  const helperText = props.sendWithShiftEnter ? (
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
        options={commandOptions}
        value={props.value}
        open={open}
        autoHighlight
        freeSolo
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
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <InputAdornment position="end">
                  {props.onCancel && (
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={onCancel}
                      title={'Cancel edition'}
                      className={clsx(CANCEL_BUTTON_CLASS)}
                    >
                      <Cancel />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={onSend}
                    disabled={
                      props.onCancel
                        ? input === props.value
                        : !input.trim().length
                    }
                    title={`Send message ${sendWithShiftEnter ? '(SHIFT+ENTER)' : '(ENTER)'}`}
                    className={clsx(SEND_BUTTON_CLASS)}
                  >
                    <Send />
                  </IconButton>
                </InputAdornment>
              )
            }}
            FormHelperTextProps={{
              sx: { marginLeft: 'auto', marginRight: 0 }
            }}
            helperText={input.length > 2 ? helperText : ' '}
          />
        )}
        {...autocompletion.current?.props}
        inputValue={input}
        onInputChange={(_, newValue: string) => {
          setInput(newValue);
        }}
        onHighlightChange={
          /**
           * On highlight change: set `highlighted` to whether an option is
           * highlighted by the user.
           *
           * This isn't called when an option is selected for some reason, so we
           * need to call `setHighlighted(false)` in `onClose()`.
           */
          (_, highlightedOption) => {
            setHighlighted(!!highlightedOption);
          }
        }
        onClose={
          /**
           * On close: set `highlighted` to `false` and close the popup by
           * setting `open` to `false`.
           */
          () => {
            setHighlighted(false);
            setOpen(false);
          }
        }
        // hide default extra right padding in the text field
        disableClearable
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
     * Whether using shift+enter to send the message.
     */
    sendWithShiftEnter: boolean;
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
  }
}
