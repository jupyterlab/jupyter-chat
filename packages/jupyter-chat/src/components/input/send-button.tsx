/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import SendIcon from '@mui/icons-material/Send';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { TooltippedButton } from '../mui-extras/tooltipped-button';
import { includeSelectionIcon } from '../../icons';
import { IInputModel } from '../../input-model';
import { Selection } from '../../types';

const SEND_BUTTON_CLASS = 'jp-chat-send-button';
const SEND_INCLUDE_OPENER_CLASS = 'jp-chat-send-include-opener';
const SEND_INCLUDE_LI_CLASS = 'jp-chat-send-include';

/**
 * The send button props.
 */
export type SendButtonProps = {
  model: IInputModel;
  sendWithShiftEnter: boolean;
  inputExists: boolean;
  onSend: (selection?: Selection) => unknown;
  hideIncludeSelection?: boolean;
  hasButtonOnLeft?: boolean;
};

/**
 * The send button, with optional 'include selection' menu.
 */
export function SendButton(props: SendButtonProps): JSX.Element {
  const { activeCellManager, selectionWatcher } = props.model;
  const hideIncludeSelection = props.hideIncludeSelection ?? false;
  const hasButtonOnLeft = props.hasButtonOnLeft ?? false;
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback((el: HTMLElement | null) => {
    setMenuAnchorEl(el);
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const disabled = !props.inputExists;

  const [selectionTooltip, setSelectionTooltip] = useState<string>('');
  const [disableInclude, setDisableInclude] = useState<boolean>(true);

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
  }, [activeCellManager, selectionWatcher, hideIncludeSelection]);

  const defaultTooltip = props.sendWithShiftEnter
    ? 'Send message (SHIFT+ENTER)'
    : 'Send message (ENTER)';
  const tooltip = defaultTooltip;

  function sendWithSelection() {
    // Append the selected text if exists.
    if (selectionWatcher?.selection) {
      props.onSend({
        type: 'text',
        source: selectionWatcher.selection.text
      });
      closeMenu();
      return;
    }

    // Append the active cell content if exists.
    if (activeCellManager?.available) {
      props.onSend({
        type: 'cell',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        source: activeCellManager.getContent(false)!.source
      });
      closeMenu();
      return;
    }
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
      <TooltippedButton
        onClick={() => props.onSend()}
        disabled={disabled}
        tooltip={tooltip}
        buttonProps={{
          size: 'small',
          title: defaultTooltip,
          variant: 'contained',
          className: SEND_BUTTON_CLASS
        }}
        sx={{
          minWidth: 'unset',
          borderTopLeftRadius: hasButtonOnLeft ? '0px' : '2px',
          borderTopRightRadius: hideIncludeSelection ? '2px' : '0px',
          borderBottomRightRadius: hideIncludeSelection ? '2px' : '0px',
          borderBottomLeftRadius: hasButtonOnLeft ? '0px' : '2px'
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
            sx={{
              minWidth: 'unset',
              padding: '4px 0px',
              borderRadius: '0px 2px 2px 0px',
              marginLeft: '1px'
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
    </Box>
  );
}
