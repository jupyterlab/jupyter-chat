/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import clsx from 'clsx';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import SendIcon from '@mui/icons-material/Send';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import React, { useCallback, useState } from 'react';

import { IChatModel } from '../../model';
import { TooltippedButton } from '../mui-extras/tooltipped-button';
import { includeSelectionIcon } from '../../icons';
import { Selection } from '../../types';

const SEND_BUTTON_CLASS = 'jp-chat-send-button';

export type SendButtonProps = {
  model: IChatModel;
  sendWithShiftEnter: boolean;
  inputExists: boolean;
  onSend: (selection?: Selection) => unknown;
};

export function SendButton(props: SendButtonProps): JSX.Element {
  const { model } = props;
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

  const includeSelectionDisabled = !model.selectionWatcher;
  // const includeSelectionDisabled = !(activeCell.exists || textSelection);
  const buildSelectionTooltip = () => {
    return model.selectionWatcher?.selection
      ? `${model.selectionWatcher.selection.numLines} lines selected`
      : model.activeCellManager?.available
        ? 'Code from 1 active cell'
        : 'No selection or active cell';
  };

  const [selectionTooltip, setSelectionTooltip] = useState<string>(
    buildSelectionTooltip()
  );

  model.selectionWatcher?.selectionChanged.connect(() => {
    setSelectionTooltip(buildSelectionTooltip());
  });

  const defaultTooltip = props.sendWithShiftEnter
    ? 'Send message (SHIFT+ENTER)'
    : 'Send message (ENTER)';
  const tooltip = defaultTooltip;

  function sendWithSelection() {
    // otherwise, parse the text selection or active cell, with the text
    // selection taking precedence.
    if (model.selectionWatcher?.selection) {
      props.onSend({
        type: 'text',
        source: model.selectionWatcher.selection.text
      });
      closeMenu();
      return;
    }

    if (model.activeCellManager?.available) {
      props.onSend({
        type: 'cell',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        source: model.activeCellManager.getContent(false)!.source
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
          className: clsx(SEND_BUTTON_CLASS)
        }}
        sx={{
          minWidth: 'unset',
          borderRadius: '2px 0px 0px 2px'
        }}
      >
        <SendIcon />
      </TooltippedButton>
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
          }
        }}
        sx={{
          minWidth: 'unset',
          padding: '4px 0px',
          borderRadius: '0px 2px 2px 0px',
          borderLeft: '1px solid white'
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
          disabled={includeSelectionDisabled}
        >
          <includeSelectionIcon.react />
          <Box>
            <Typography display="block">Send message with selection</Typography>
            <Typography display="block" sx={{ opacity: 0.618 }}>
              {selectionTooltip}
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}
