/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  Autocomplete,
  AutocompleteInputChangeReason,
  Box,
  InputAdornment,
  SxProps,
  TextField,
  Theme
} from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import { AttachmentPreviewList } from './attachments';
import { InputToolbarRegistry, useChatCommands } from './input';
import { IInputModel, InputModel } from '../input-model';
import { IAttachment } from '../types';
import { IChatCommandRegistry } from '../chat-commands';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const INPUT_TOOLBAR_CLASS = 'jp-chat-input-toolbar';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { model, toolbarRegistry } = props;
  const [input, setInput] = useState<string>(model.value);
  const inputRef = useRef<HTMLInputElement>();

  const chatCommands = useChatCommands(model, props.chatCommandRegistry);

  const [sendWithShiftEnter, setSendWithShiftEnter] = useState<boolean>(
    model.config.sendWithShiftEnter ?? false
  );
  const [attachments, setAttachments] = useState<IAttachment[]>(
    model.attachments
  );
  const [toolbarElements, setToolbarElements] = useState<
    InputToolbarRegistry.IToolbarItem[]
  >([]);

  /**
   * Handle the changes on the model that affect the input.
   * - focus requested
   * - config changed
   * - attachments changed
   */
  useEffect(() => {
    const inputChanged = (_: IInputModel, value: string) => {
      setInput(value);
    };
    model.valueChanged.connect(inputChanged);

    const configChanged = (_: IInputModel, config: InputModel.IConfig) => {
      setSendWithShiftEnter(config.sendWithShiftEnter ?? false);
    };
    model.configChanged.connect(configChanged);

    const focusInputElement = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    model.focusInputSignal?.connect(focusInputElement);

    const attachmentChanged = (_: IInputModel, attachments: IAttachment[]) => {
      setAttachments([...attachments]);
    };
    model.attachmentsChanged?.connect(attachmentChanged);

    return () => {
      model.configChanged?.disconnect(configChanged);
      model.focusInputSignal?.disconnect(focusInputElement);
      model.attachmentsChanged?.disconnect(attachmentChanged);
    };
  }, [model]);

  /**
   * Handle the changes in the toolbar items.
   */
  useEffect(() => {
    const updateToolbar = () => {
      setToolbarElements(toolbarRegistry.getItems());
    };

    toolbarRegistry.itemsChanged.connect(updateToolbar);
    updateToolbar();

    return () => {
      toolbarRegistry.itemsChanged.disconnect(updateToolbar);
    };
  }, [toolbarRegistry]);

  const inputExists = !!input.trim();

  /**
   * `handleKeyDown()`: callback invoked when the user presses any key in the
   * `TextField` component. This is used to send the message when a user presses
   * "Enter". This also handles many of the edge cases in the MUI Autocomplete
   * component.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    /**
     * IMPORTANT: This statement ensures that arrow keys can be used to navigate
     * the multiline input when the chat commands menu is closed.
     */
    if (
      ['ArrowDown', 'ArrowUp'].includes(event.key) &&
      !chatCommands.menu.open
    ) {
      event.stopPropagation();
      return;
    }

    // remainder of this function only handles the "Enter" key.
    if (event.key !== 'Enter') {
      return;
    }

    /**
     * IMPORTANT: This statement ensures that when the chat commands menu is
     * open with a highlighted command, the "Enter" key should run that command
     * instead of sending the message.
     *
     * This is done by returning early and letting the event propagate to the
     * `Autocomplete` component.
     */
    if (chatCommands.menu.highlighted) {
      return;
    }

    // remainder of this function only handles the "Enter" key pressed while the
    // commands menu is closed.
    /**
     * IMPORTANT: This ensures that when the "Enter" key is pressed with the
     * commands menu closed, the event is not propagated up to the
     * `Autocomplete` component. Without this, `Autocomplete.onChange()` gets
     * called with an invalid `string` instead of a `ChatCommand`.
     */
    event.stopPropagation();

    // Do not send empty messages, and avoid adding new line in empty message.
    if (!inputExists) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // Finally, send the message when all other conditions are met.
    if (
      (sendWithShiftEnter && event.shiftKey) ||
      (!sendWithShiftEnter && !event.shiftKey)
    ) {
      model.send(input);
      event.stopPropagation();
      event.preventDefault();
    }
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
      <AttachmentPreviewList
        attachments={attachments}
        onRemove={model.removeAttachment}
      />
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
            sx={{ marginTop: '1px' }}
            onSelect={() =>
              (model.cursorIndex = inputRef.current?.selectionStart ?? null)
            }
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <InputAdornment position="end" className={INPUT_TOOLBAR_CLASS}>
                  {toolbarElements.map(item => (
                    <item.element model={model} />
                  ))}
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
        onInputChange={(
          _,
          newValue: string,
          reason: AutocompleteInputChangeReason
        ) => {
          // Do not update the value if the reason is 'reset', which should occur only
          // if an autocompletion command has been selected. In this case, the value is
          // set in the 'onChange()' callback of the autocompletion (to avoid conflicts).
          if (reason !== 'reset') {
            model.value = newValue;
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
    model: IInputModel;
    /**
     * The toolbar registry.
     */
    toolbarRegistry: InputToolbarRegistry;
    /**
     * The function to be called to cancel editing.
     */
    onCancel?: () => unknown;
    /**
     * Custom mui/material styles.
     */
    sx?: SxProps<Theme>;
    /**
     * Chat command registry.
     */
    chatCommandRegistry?: IChatCommandRegistry;
  }
}
