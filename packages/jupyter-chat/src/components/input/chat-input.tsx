/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  Autocomplete,
  AutocompleteInputChangeReason,
  Box,
  SxProps,
  TextField,
  Theme
} from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import { InputToolbarRegistry } from './toolbar-registry';
import { useChatCommands } from './use-chat-commands';
import { AttachmentPreviewList } from '../attachments';
import { useChatContext } from '../../context';
import { IInputModel, InputModel } from '../../input-model';
import { IChatModel } from '../../model';
import { InputWritingIndicator } from './writing-indicator';
import { IAttachment } from '../../types';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const INPUT_TEXTFIELD_CLASS = 'jp-chat-input-textfield';
const INPUT_TOOLBAR_CLASS = 'jp-chat-input-toolbar';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { model } = props;
  const { area, chatCommandRegistry, inputToolbarRegistry } = useChatContext();
  const chatModel = useChatContext().model;

  const [input, setInput] = useState<string>(model.value);
  const inputRef = useRef<HTMLInputElement>();

  const chatCommands = useChatCommands(model, chatCommandRegistry);

  const [sendWithShiftEnter, setSendWithShiftEnter] = useState<boolean>(
    model.config.sendWithShiftEnter ?? false
  );
  const [attachments, setAttachments] = useState<IAttachment[]>(
    model.attachments
  );
  const [toolbarElements, setToolbarElements] = useState<
    InputToolbarRegistry.IToolbarItem[]
  >([]);
  const [writers, setWriters] = useState<IChatModel.IWriter[]>([]);

  /**
   * Auto-focus the input when the component is first mounted.
   */
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
      setToolbarElements(inputToolbarRegistry?.getItems() || []);
    };

    inputToolbarRegistry?.itemsChanged.connect(updateToolbar);
    updateToolbar();

    return () => {
      inputToolbarRegistry?.itemsChanged.disconnect(updateToolbar);
    };
  }, [inputToolbarRegistry]);

  /**
   * Handle the changes in the writers list.
   */
  useEffect(() => {
    if (!chatModel) {
      return;
    }

    const updateWriters = (_: IChatModel, writers: IChatModel.IWriter[]) => {
      // Show all writers for now - AI generating responses will have messageID
      setWriters(writers);
    };

    // Set initial writers state
    const initialWriters = chatModel.writers;
    setWriters(initialWriters);

    chatModel.writersChanged?.connect(updateWriters);

    return () => {
      chatModel?.writersChanged?.disconnect(updateWriters);
    };
  }, [chatModel]);

  const inputExists = !!input.trim();

  /**
   * `handleKeyDown()`: callback invoked when the user presses any key in the
   * `TextField` component. This is used to send the message when a user presses
   * "Enter". This also handles many of the edge cases in the MUI Autocomplete
   * component.
   */
  async function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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
     * open, the "Enter" key should select the command (handled by Autocomplete)
     * instead of sending the message.
     *
     * This is done by returning early and letting the event propagate to the
     * `Autocomplete` component, which will select the auto-highlighted option
     * thanks to autoSelect: true.
     */
    if (chatCommands.menu.open) {
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
      // Run all command providers
      await chatCommandRegistry?.onSubmit(model);
      model.send(model.value);
      event.stopPropagation();
      event.preventDefault();
    }
  }

  const horizontalPadding = area === 'sidebar' ? 1.5 : 2;

  return (
    <Box
      sx={props.sx}
      className={clsx(INPUT_BOX_CLASS)}
      data-input-id={model.id}
    >
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'var(--jp-border-color1)',
          borderRadius: 2,
          transition: 'border-color 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {attachments.length > 0 && (
          <Box
            sx={{
              px: horizontalPadding,
              pt: 1,
              pb: 1
            }}
          >
            <AttachmentPreviewList
              attachments={attachments}
              onRemove={model.removeAttachment}
            />
          </Box>
        )}
        <Autocomplete
          {...chatCommands.autocompleteProps}
          slotProps={{
            ...(chatCommands.autocompleteProps.slotProps || {}),
            popper: {
              placement: 'top-start'
            },
            listbox: {
              sx: {
                padding: 0
              }
            }
          }}
          renderInput={params => (
            <TextField
              {...params}
              fullWidth
              variant="standard"
              className={INPUT_TEXTFIELD_CLASS}
              multiline
              maxRows={10}
              onKeyDown={handleKeyDown}
              placeholder="Type a chat message, @ to mention..."
              inputRef={inputRef}
              onSelect={() =>
                (model.cursorIndex = inputRef.current?.selectionStart ?? null)
              }
              sx={{
                padding: 1.5,
                margin: 0,
                boxSizing: 'border-box',
                backgroundColor: 'var(--jp-layout-color0)',
                transition: 'background-color 0.2s ease',
                '& .MuiInputBase-root': {
                  padding: 0,
                  margin: 0,
                  '&:before': {
                    display: 'none'
                  },
                  '&:after': {
                    display: 'none'
                  }
                },
                '& .MuiInputBase-input': {
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word'
                }
              }}
              InputProps={{
                ...params.InputProps,
                disableUnderline: true
              }}
              FormHelperTextProps={{
                sx: { display: 'none' }
              }}
            />
          )}
          inputValue={input}
          onInputChange={(
            _,
            newValue: string,
            reason: AutocompleteInputChangeReason
          ) => {
            // Skip value updates when an autocomplete option is selected.
            // The 'onChange' callback handles the replacement via replaceCurrentWord.
            // 'selectOption' - user selected an option (newValue is just the option label)
            // 'reset' - autocomplete is resetting after selection
            // 'blur' - when user blurs the input (newValue is set to empty string)
            if (
              reason === 'selectOption' ||
              reason === 'reset' ||
              reason === 'blur'
            ) {
              return;
            }
            model.value = newValue;
          }}
        />
        <Box
          className={INPUT_TOOLBAR_CLASS}
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            padding: 1.5,
            borderTop: '1px solid',
            borderColor: 'var(--jp-border-color1)',
            backgroundColor: 'var(--jp-layout-color0)',
            transition: 'background-color 0.2s ease'
          }}
        >
          {toolbarElements.map((item, index) => (
            <item.element
              key={index}
              model={model}
              chatCommandRegistry={chatCommandRegistry}
              chatModel={chatModel}
              edit={props.edit}
            />
          ))}
        </Box>
      </Box>
      <InputWritingIndicator writers={writers} />
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
     * The input model.
     */
    model: IInputModel;
    /**
     * The function to be called to cancel editing.
     */
    onCancel?: () => unknown;
    /**
     * Custom mui/material styles.
     */
    sx?: SxProps<Theme>;
    /**
     * Whether the input is in edit mode (editing an existing message).
     * Defaults to false (new message mode).
     */
    edit?: boolean;
  }
}
