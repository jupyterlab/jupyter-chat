/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras';
import { useTranslator } from '../../../context';
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
  const { model, chatCommandRegistry, edit } = props;
  const { activeCellManager, selectionWatcher } = model;
  const hideIncludeSelection = !activeCellManager || !selectionWatcher;
  const trans = useTranslator();

  // Don't show this button when in edit mode
  if (edit) {
    return <></>;
  }

  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [tooltip, setTooltip] = useState<string>('');
  const [selectionTooltip, setSelectionTooltip] = useState<string>('');
  const [disableInclude, setDisableInclude] = useState<boolean>(true);

  const openMenu = useCallback((el: HTMLElement | null) => {
    setMenuAnchorEl(el);
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

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
          ? trans.__('Send message (SHIFT+ENTER)')
          : trans.__('Send message (ENTER)')
      );
    };
    model.configChanged.connect(configChanged);

    // Initialize the tooltip.
    configChanged(model, model.config);

    return () => {
      model.valueChanged.disconnect(inputChanged);
      model.attachmentsChanged?.disconnect(inputChanged);
      model.configChanged?.disconnect(configChanged);
    };
  }, [model]);

  useEffect(() => {
    const toggleIncludeState = () => {
      setDisableInclude(
        !(selectionWatcher?.selection || activeCellManager?.available)
      );
      const tip = selectionWatcher?.selection
        ? trans.__('%1 line(s) selected', selectionWatcher.selection.numLines)
        : activeCellManager?.available
          ? trans.__('Code from 1 active cell')
          : trans.__('No selection or active cell');
      setSelectionTooltip(tip);
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
    // Run all command providers
    await chatCommandRegistry?.onSubmit(model);

    const body = model.value;

    model.value = '';
    model.send(body);
    model.focus();
  }

  async function sendWithSelection() {
    await chatCommandRegistry?.onSubmit(model);

    let source = '';
    let language: string | undefined;

    if (selectionWatcher?.selection) {
      source = selectionWatcher.selection.text;
      language = selectionWatcher.selection.language;
    } else if (activeCellManager?.available) {
      const content = activeCellManager.getContent(false);
      source = content!.source;
      language = content?.language;
    }

    let body = model.value;
    if (source) {
      body += `\n\n\`\`\`${language ?? ''}\n${source}\n\`\`\`\n`;
    }

    model.value = '';
    closeMenu();
    model.send(body);
    model.focus();
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
      <TooltippedIconButton
        onClick={send}
        tooltip={tooltip}
        disabled={disabled}
        sx={{
          borderRadius: hideIncludeSelection
            ? 'var(--jp-border-radius)'
            : 'var(--jp-border-radius) 0 0 var(--jp-border-radius) !important'
        }}
        buttonProps={{
          title: tooltip,
          className: SEND_BUTTON_CLASS
        }}
        aria-label={tooltip}
      >
        <ArrowUpwardIcon />
      </TooltippedIconButton>
      {!hideIncludeSelection && (
        <>
          <TooltippedIconButton
            onClick={e => openMenu(e.currentTarget)}
            tooltip={trans.__('Send with selection')}
            disabled={disabled}
            sx={{
              borderRadius:
                '0 var(--jp-border-radius) var(--jp-border-radius) 0 !important',
              width: '16px',
              minWidth: '16px'
            }}
            buttonProps={{
              onKeyDown: e => {
                if (e.key !== 'Enter' && e.key !== ' ') {
                  return;
                }
                openMenu(e.currentTarget);
                e.stopPropagation();
              },
              className: SEND_INCLUDE_OPENER_CLASS
            }}
          >
            <KeyboardArrowDownIcon sx={{ fontSize: '12px' }} />
          </TooltippedIconButton>
          <Menu
            open={menuOpen}
            onClose={closeMenu}
            anchorEl={menuAnchorEl}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            sx={{
              '& .MuiMenuItem-root': {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              },
              '& svg': { lineHeight: 0 }
            }}
          >
            <MenuItem
              onClick={e => {
                sendWithSelection();
                e.stopPropagation();
              }}
              disabled={disableInclude}
              className={SEND_INCLUDE_LI_CLASS}
            >
              <includeSelectionIcon.react />
              <Box>
                <Typography display="block">
                  {trans.__('Send message with selection')}
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
