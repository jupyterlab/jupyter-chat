/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import SendIcon from '@mui/icons-material/Send';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedButton } from '../../mui-extras/tooltipped-button';
import { includeSelectionIcon } from '../../../icons';
import { IInputModel, InputModel } from '../../../input-model';

const SEND_BUTTON_CLASS = 'jp-chat-send-button';
const SEND_INCLUDE_OPENER_CLASS = 'jp-chat-send-include-opener';
const SEND_INCLUDE_LI_CLASS = 'jp-chat-send-include';

/**
 * The send button, with optional 'include selection' menu.
 */
export function SendButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
  const { model, chatCommandRegistry } = props;
  const { activeCellManager, selectionWatcher } = model;
  const hideIncludeSelection = !activeCellManager || !selectionWatcher;

  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [tooltip, setTooltip] = useState<string>('');

  const openMenu = useCallback((el: HTMLElement | null) => {
    setMenuAnchorEl(el);
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const [selectionTooltip, setSelectionTooltip] = useState<string>('');
  const [disableInclude, setDisableInclude] = useState<boolean>(true);

  useEffect(() => {
    const inputChanged = () => {
      const inputExist = !!model.value.trim() || model.attachments.length;
      setDisabled(!inputExist);
    };

    model.valueChanged.connect(inputChanged);
    model.attachmentsChanged?.connect(inputChanged);

    inputChanged();

    const configChanged = (_: IInputModel, config: InputModel.IConfig) => {
      setTooltip(
        (config.sendWithShiftEnter ?? false)
          ? 'Send message (SHIFT+ENTER)'
          : 'Send message (ENTER)'
      );
    };
    model.configChanged.connect(configChanged);

    return () => {
      model.valueChanged.disconnect(inputChanged);
      model.attachmentsChanged?.disconnect(inputChanged);
      model.configChanged?.disconnect(configChanged);
    };
  }, [model]);

  useEffect(() => {
    /**
     * Enable or disable the include selection button, and adapt the tooltip.
     */
    const toggleIncludeState = () => {
      setDisableInclude(
        !(selectionWatcher?.selection || activeCellManager?.available)
      );
      const tooltip = selectionWatcher?.selection
        ? `${selectionWatcher.selection.numLines} line(s) selected`
        : activeCellManager?.available
          ? 'Code from 1 active cell'
          : 'No selection or active cell';
      setSelectionTooltip(tooltip);
    };

    if (!hideIncludeSelection) {
      selectionWatcher?.selectionChanged.connect(toggleIncludeState);
      activeCellManager?.availabilityChanged.connect(toggleIncludeState);
      toggleIncludeState();
    }
    return () => {
      selectionWatcher?.selectionChanged.disconnect(toggleIncludeState);
      activeCellManager?.availabilityChanged.disconnect(toggleIncludeState);
    };
  }, [activeCellManager, selectionWatcher]);

  async function send() {
    await chatCommandRegistry?.onSubmit(model);
    model.send(model.value);
  }

  async function sendWithSelection() {
    let source = '';

    // Run all chat command providers
    await chatCommandRegistry?.onSubmit(model);

    let language = '';
    if (selectionWatcher?.selection) {
      // Append the selected text if exists.
      source = selectionWatcher.selection.text;
    } else if (activeCellManager?.available) {
      // Append the active cell content if exists.
      const content = activeCellManager.getContent(false);
      source = content!.source;
      language = content?.language || '';
    }
    let content = model.value;
    if (source) {
      content += `

\`\`\`${language}
${source}
\`\`\`
`;
    }
    model.send(content);
    closeMenu();
    model.value = '';
  }

  return (
    <>
      <TooltippedButton
        onClick={send}
        disabled={disabled}
        tooltip={tooltip}
        buttonProps={{
          size: 'small',
          title: tooltip,
          variant: 'contained',
          className: SEND_BUTTON_CLASS
        }}
      >
        <SendIcon />
      </TooltippedButton>
      {!hideIncludeSelection && (
        <>
          <TooltippedButton
            onClick={e => {
              openMenu(e.currentTarget);
            }}
            disabled={disabled}
            tooltip=""
            buttonProps={{
              variant: 'contained',
              onKeyDown: e => {
                if (e.key !== 'Enter' && e.key !== ' ') {
                  return;
                }
                openMenu(e.currentTarget);
                // stopping propagation of this event prevents the prompt from being
                // sent when the dropdown button is selected and clicked via 'Enter'.
                e.stopPropagation();
              },
              className: SEND_INCLUDE_OPENER_CLASS
            }}
          >
            <KeyboardArrowDown />
          </TooltippedButton>
          <Menu
            open={menuOpen}
            onClose={closeMenu}
            anchorEl={menuAnchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'right'
            }}
            sx={{
              '& .MuiMenuItem-root': {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              },
              '& svg': {
                lineHeight: 0
              }
            }}
          >
            <MenuItem
              onClick={e => {
                sendWithSelection();
                // prevent sending second message with no selection
                e.stopPropagation();
              }}
              disabled={disableInclude}
              className={SEND_INCLUDE_LI_CLASS}
            >
              <includeSelectionIcon.react />
              <Box>
                <Typography display="block">
                  Send message with selection
                </Typography>
                <Typography display="block" sx={{ opacity: 0.618 }}>
                  {selectionTooltip}
                </Typography>
              </Box>
            </MenuItem>
          </Menu>
        </>
      )}
    </>
  );
}
