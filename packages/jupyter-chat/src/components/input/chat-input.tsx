/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactiveToolbar, Toolbar } from '@jupyterlab/ui-components';
import { MessageLoop } from '@lumino/messaging';
import { Panel, Widget } from '@lumino/widgets';
import {
  Autocomplete,
  AutocompleteInputChangeReason,
  Box,
  SxProps,
  TextField,
  Theme
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import { InputToolbarRegistry } from './toolbar-registry';
import { submitInputMessage } from './submit-message';
import { useChatCommands } from './use-chat-commands';
import { AttachmentPreviewList } from '../attachments';
import { useChatContext, useTranslator } from '../../context';
import { IInputModel, InputModel } from '../../input-model';
import { IAttachment } from '../../types';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const INPUT_TEXTFIELD_CLASS = 'jp-chat-input-textfield';
const INPUT_TOOLBAR_CLASS = 'jp-chat-input-reactive-toolbar';
const INPUT_PINNED_CLASS = 'jp-chat-input-pinned-toolbar';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { model } = props;
  const trans = useTranslator();
  const chatContext = useChatContext();
  const { area, chatCommandRegistry, inputToolbarRegistry } = chatContext;
  const chatModel = chatContext.model;
  const theme = useTheme();

  const [input, setInput] = useState<string>(model.value);
  const inputRef = useRef<HTMLInputElement>();

  const chatCommands = useChatCommands(model, chatCommandRegistry);

  const [sendWithShiftEnter, setSendWithShiftEnter] = useState<boolean>(
    model.config.sendWithShiftEnter ?? false
  );
  const [placeholder, setPlaceholder] = useState<string | undefined>(
    model.config.inputPlaceholder
  );
  const [attachments, setAttachments] = useState<IAttachment[]>(
    model.attachments
  );

  const toolbarsContainerRef = useRef<HTMLDivElement>(null);
  const reactiveToolbarRef = useRef<ReactiveToolbar | null>(null);
  const reactiveToolbarItemsRef = useRef<Map<string, Widget>>(new Map());
  const pinnedToolbarRef = useRef<Toolbar | null>(null);
  const pinnedToolbarItemsRef = useRef<Map<string, Widget>>(new Map());

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
      setPlaceholder(config.inputPlaceholder);
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
   * Mount both toolbars inside a shared Lumino Panel host once. A ResizeObserver
   * bridges DOM resizes to Lumino's message system so the ReactiveToolbar can
   * compute overflow — it has no internal observer and requires a Lumino parent.
   */
  useEffect(() => {
    const toolbarsContainer = toolbarsContainerRef.current;
    if (!toolbarsContainer) {
      return;
    }

    const host = new Panel();
    host.addClass(`${INPUT_TOOLBAR_CLASS}-host`);
    const reactiveToolbar = new ReactiveToolbar({ noFocusOnClick: true });
    reactiveToolbar.addClass(INPUT_TOOLBAR_CLASS);
    host.addWidget(reactiveToolbar);

    const pinnedToolbar = new Toolbar({ noFocusOnClick: true });
    pinnedToolbar.addClass(INPUT_PINNED_CLASS);
    host.addWidget(pinnedToolbar);

    Widget.attach(host, toolbarsContainer);
    reactiveToolbarRef.current = reactiveToolbar;
    pinnedToolbarRef.current = pinnedToolbar;

    // TODO: improve the way to add the class, `popupOpener` and `popup` are
    // both protected in the JupyterLab types.
    const popup = (
      reactiveToolbar as unknown as { popupOpener: { popup: Widget } }
    ).popupOpener.popup;
    popup.addClass(`${INPUT_TOOLBAR_CLASS}-popup`);

    const resizeObserver = new ResizeObserver(() => {
      if (host.isDisposed || !host.isAttached) {
        return;
      }
      const hostWidth = host.node.offsetWidth;
      const hostHeight = host.node.offsetHeight;
      if (hostWidth > 0) {
        MessageLoop.sendMessage(
          host,
          new Widget.ResizeMessage(hostWidth, hostHeight)
        );
        // The reactiveToolbar occupies only its flex share, not the full host width.
        MessageLoop.sendMessage(
          reactiveToolbar,
          new Widget.ResizeMessage(reactiveToolbar.node.offsetWidth, hostHeight)
        );
      }
    });
    resizeObserver.observe(toolbarsContainer);

    return () => {
      resizeObserver.disconnect();
      reactiveToolbarItemsRef.current = new Map();
      pinnedToolbarItemsRef.current = new Map();
      // React may have already removed the host DOM node by the time this
      // cleanup runs, which would make Widget.detach (called from dispose())
      // throw. Clear the attached flag in that case so dispose() is a no-op
      // on the DOM side.
      if (host.isAttached && !host.node.isConnected) {
        host.clearFlag(Widget.Flag.IsAttached);
      }
      host.dispose();
      reactiveToolbarRef.current = null;
      pinnedToolbarRef.current = null;
    };
  }, []);

  /**
   * Sync both toolbars with the registry on every `itemsChanged`. Pinned items
   * go into the pinned toolbar (fixed slot, never overflows); unpinned items go
   * into the ReactiveToolbar.
   */
  useEffect(() => {
    const reactiveToolbar = reactiveToolbarRef.current;
    const pinnedToolbar = pinnedToolbarRef.current;
    if (!reactiveToolbar || !pinnedToolbar) {
      return;
    }

    // Rebuild the items, to change the theme if necessary.
    for (const widget of reactiveToolbarItemsRef.current.values()) {
      widget.dispose();
    }
    reactiveToolbarItemsRef.current.clear();
    for (const widget of pinnedToolbarItemsRef.current.values()) {
      widget.dispose();
    }
    pinnedToolbarItemsRef.current.clear();

    const sync = () => {
      const entries = Array.from(inputToolbarRegistry?.items ?? []);
      const context: InputToolbarRegistry.IToolbarItemContext = {
        model,
        chatCommandRegistry,
        chatModel,
        edit: props.edit,
        theme,
        chatContext
      };

      const toolbarEntries = entries.filter(([, item]) => !item.pinned);
      const pinnedEntries = entries.filter(([, item]) => item.pinned);
      let visibilityChanged = false;

      // Dispose removed widgets, create missing ones, and sync visibility.
      // Existing widgets are reused in place, no re-creation on reorder.
      const reconcile = (
        widgets: Map<string, Widget>,
        slotEntries: typeof entries,
        toolbar: Toolbar
      ) => {
        const nextNames = new Set(slotEntries.map(([name]) => name));
        for (const [name, widget] of widgets) {
          if (!nextNames.has(name)) {
            widget.dispose();
            widgets.delete(name);
          }
        }
        slotEntries.forEach(([name, item], idx) => {
          const hidden = item.hidden ?? false;
          const existing = widgets.get(name);
          if (existing) {
            if (existing.isHidden !== hidden) {
              existing.setHidden(hidden);
              visibilityChanged = true;
            }
            return;
          }
          if (!item.createWidget) {
            return;
          }
          const widget = item.createWidget(context);
          widget.setHidden(hidden);
          widgets.set(name, widget);
          toolbar.insertItem(idx, name, widget);
        });
      };

      reconcile(
        reactiveToolbarItemsRef.current,
        toolbarEntries,
        reactiveToolbar
      );
      reconcile(pinnedToolbarItemsRef.current, pinnedEntries, pinnedToolbar);

      // Toggling a child's visibility doesn't trigger the toolbar's own
      // resize path, so overflow would stay stale. Nudge it manually.
      if (visibilityChanged) {
        const width = reactiveToolbar.node.clientWidth;
        const height = reactiveToolbar.node.clientHeight;
        if (width > 0) {
          MessageLoop.sendMessage(
            reactiveToolbar,
            new Widget.ResizeMessage(width, height)
          );
        }
      }
    };

    sync();
    inputToolbarRegistry?.itemsChanged.connect(sync);

    return () => {
      inputToolbarRegistry?.itemsChanged.disconnect(sync);
    };
  }, [inputToolbarRegistry, theme]);

  const inputExists = !!input.trim();

  // The default is resolved here rather than in `IConfig`, so that it can be
  // translated. Only `undefined` falls back; an empty string is a valid choice.
  const inputPlaceholder =
    placeholder ?? trans.__('Type a chat message, @ to mention...');

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

    const isSendCombination =
      (sendWithShiftEnter && event.shiftKey) ||
      (!sendWithShiftEnter && !event.shiftKey);

    // Do not send empty messages, and avoid adding new line in empty message.
    if (!inputExists && (!isSendCombination || attachments.length === 0)) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // Finally, send the message when all other conditions are met.
    if (isSendCombination) {
      await submitInputMessage({ model, chatCommandRegistry });
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
              placeholder={inputPlaceholder}
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
          ref={toolbarsContainerRef}
          className={`${INPUT_TOOLBAR_CLASS}-container`}
          sx={{
            padding: 1.5,
            borderTop: '1px solid',
            borderColor: 'var(--jp-border-color1)',
            backgroundColor: 'var(--jp-layout-color0)',
            transition: 'background-color 0.2s ease'
          }}
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
