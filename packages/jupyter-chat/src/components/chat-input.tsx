/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useState } from 'react';

import {
  Box,
  SxProps,
  TextField,
  Theme,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Send, Cancel } from '@mui/icons-material';
import clsx from 'clsx';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const SEND_BUTTON_CLASS = 'jp-chat-send-button';
const CANCEL_BUTTON_CLASS = 'jp-chat-cancel-button';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const [input, setInput] = useState(props.value || '');

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === 'Enter' &&
      ((props.sendWithShiftEnter && event.shiftKey) ||
        (!props.sendWithShiftEnter && !event.shiftKey))
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
      <Box sx={{ display: 'flex' }}>
        <TextField
          value={input}
          onChange={e => setInput(e.target.value)}
          fullWidth
          variant="outlined"
          multiline
          onKeyDown={handleKeyDown}
          placeholder="Start chatting"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {props.onCancel && (
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={onCancel}
                    disabled={!input.trim().length}
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
                  disabled={!input.trim().length}
                  title={`Send message ${props.sendWithShiftEnter ? '(SHIFT+ENTER)' : '(ENTER)'}`}
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
      </Box>
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
  }
}
