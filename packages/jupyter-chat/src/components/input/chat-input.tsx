/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactiveToolbar, ReactWidget } from '@jupyterlab/ui-components';
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
import { ThemeProvider, useTheme } from '@mui/material/styles';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import { InputToolbarRegistry } from './toolbar-registry';
import { submitInputMessage } from './submit-message';
import { useChatCommands } from './use-chat-commands';
import { AttachmentPreviewList } from '../attachments';
import { Chat } from '../chat';
import { ChatReactContext, useChatContext, useTranslator } from '../../context';
import { IInputModel, InputModel } from '../../input-model';
import { IAttachment } from '../../types';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const INPUT_TEXTFIELD_CLASS = 'jp-chat-input-textfield';
const INPUT_TOOLBAR_CLASS = 'jp-chat-input-toolbar';

/**
 * Lumino widget wrapping a single toolbar item's React element. Keeping the
 * widget instance stable across prop updates (edit mode, theme, chat context)
 * lets us re-render in place instead of disposing/recreating every item each
 * time the registry fires `itemsChanged` — which was the source of the flicker
 * when a sibling extension appended a button.
 */
class ToolbarItemWidget extends ReactWidget {
  constructor(
    readonly item: InputToolbarRegistry.IToolbarItem,
    private _props: InputToolbarRegistry.IToolbarItemProps,
    private _theme: Theme,
    private _chatContext: Chat.IChatProps
  ) {
    super();
  }

  updateContext(
    props: InputToolbarRegistry.IToolbarItemProps,
    theme: Theme,
    chatContext: Chat.IChatProps
  ): void {
    this._props = props;
    this._theme = theme;
    this._chatContext = chatContext;
    this.update();
  }

  render(): JSX.Element {
    const Element = this.item.element;
    return (
      <ThemeProvider theme={this._theme}>
        <ChatReactContext.Provider value={this._chatContext}>
          <Element {...this._props} />
        </ChatReactContext.Provider>
      </ThemeProvider>
    );
  }
}

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

  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const toolbarHostRef = useRef<Panel | null>(null);
  const toolbarRef = useRef<ReactiveToolbar | null>(null);
  const toolbarItemsRef = useRef<Map<string, ToolbarItemWidget>>(new Map());

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
   * Create the ReactiveToolbar once, attach it to the container, and watch for
   * resizes so it can move overflow items into the popup opener.
   *
   * The toolbar is wrapped in a Lumino `Panel` host rather than attached
   * directly to the DOM container: `ReactiveToolbar._onResize` bails out
   * early when `this.parent` is null, so without a Lumino parent the
   * overflow computation never runs.
   */
  useEffect(() => {
    const container = toolbarContainerRef.current;
    if (!container) {
      return;
    }

    const host = new Panel();
    host.addClass(`${INPUT_TOOLBAR_CLASS}-host`);
    const toolbar = new ReactiveToolbar({ noFocusOnClick: true });
    toolbar.addClass(INPUT_TOOLBAR_CLASS);
    host.addWidget(toolbar);
    Widget.attach(host, container);
    toolbarHostRef.current = host;
    toolbarRef.current = toolbar;

    // The overflow popup is a sibling of body (attached by ReactiveToolbar
    // itself), so we tag it with a dedicated class and flip it above the
    // opener via CSS. `popupOpener` and `popup` are `protected` on the
    // JupyterLab types, hence the targeted cast.
    const popup = (toolbar as unknown as { popupOpener: { popup: Widget } })
      .popupOpener.popup;
    popup.addClass(`${INPUT_TOOLBAR_CLASS}-popup`);

    const resizeObserver = new ResizeObserver(() => {
      if (host.isDisposed || !host.isAttached) {
        return;
      }
      const width = host.node.offsetWidth;
      const height = host.node.offsetHeight;
      if (width > 0) {
        MessageLoop.sendMessage(host, new Widget.ResizeMessage(width, height));
        MessageLoop.sendMessage(
          toolbar,
          new Widget.ResizeMessage(width, height)
        );
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      toolbarItemsRef.current = new Map();
      // React may have already removed the host DOM node by the time this
      // cleanup runs, which would make Widget.detach (called from dispose())
      // throw. Clear the attached flag in that case so dispose() is a no-op
      // on the DOM side.
      if (host.isAttached && !host.node.isConnected) {
        host.clearFlag(Widget.Flag.IsAttached);
      }
      host.dispose();
      toolbarHostRef.current = null;
      toolbarRef.current = null;
    };
  }, []);

  /**
   * Sync the toolbar with the registry whenever its items change or when any
   * dependency referenced by the wrapped React element changes. Existing
   * widgets are re-rendered in place; only added/removed items touch the
   * widget tree. Items are inserted in reverse position order so that
   * lower-position items (e.g. cancel/attach) are the first to overflow into
   * the popup, while the send button stays visible on the right.
   */
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) {
      return;
    }

    const sync = () => {
      const widgets = toolbarItemsRef.current;
      const entries = Array.from(inputToolbarRegistry?.items ?? []).reverse();
      const nextNames = new Set(entries.map(([name]) => name));
      const itemProps: InputToolbarRegistry.IToolbarItemProps = {
        model,
        chatCommandRegistry,
        chatModel,
        edit: props.edit
      };
      let visibilityChanged = false;

      for (const [name, widget] of widgets) {
        if (!nextNames.has(name)) {
          widget.dispose();
          widgets.delete(name);
        }
      }

      entries.forEach(([name, item], idx) => {
        const hidden = item.hidden ?? false;
        const existing = widgets.get(name);
        if (existing) {
          existing.updateContext(itemProps, theme, chatContext);
          if (existing.isHidden !== hidden) {
            existing.setHidden(hidden);
            visibilityChanged = true;
          }
          return;
        }
        const widget = new ToolbarItemWidget(
          item,
          itemProps,
          theme,
          chatContext
        );
        widget.setHidden(hidden);
        widgets.set(name, widget);
        toolbar.insertItem(idx, name, widget);
      });

      // Toggling a child's visibility doesn't trigger the toolbar's own
      // resize path, so overflow would stay stale. Nudge it manually.
      if (visibilityChanged) {
        const width = toolbar.node.clientWidth;
        const height = toolbar.node.clientHeight;
        if (width > 0) {
          MessageLoop.sendMessage(
            toolbar,
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
  }, [
    inputToolbarRegistry,
    props.edit,
    model,
    chatCommandRegistry,
    chatModel,
    chatContext,
    theme
  ]);

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
          ref={toolbarContainerRef}
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
