/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CodeIcon from '@mui/icons-material/Code';
import React, { useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedButton } from '../../mui-extras/tooltipped-button';

const ATTACH_CODE_CELL_BUTTON_CLASS = 'jp-chat-attach-code-cell-button';

/**
 * The attach code cell or selection button.
 */
export function AttachCodeCellButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
  const { model } = props;
  const { activeCellManager, selectionWatcher } = model;

  const [tooltip, setTooltip] = useState<string>('');
  const [disabled, setDisabled] = useState<boolean>(true);

  // Check if the button should be hidden (no activeCellManager or selectionWatcher)
  if (!activeCellManager || !selectionWatcher) {
    return <></>;
  }

  useEffect(() => {
    const updateButtonState = () => {
      const hasSelection = !!selectionWatcher.selection?.text;
      const hasCellContent = activeCellManager.available;

      if (hasSelection) {
        setTooltip('Attach selected code');
        setDisabled(false);
      } else if (hasCellContent) {
        setTooltip('Attach active cell');
        setDisabled(false);
      } else {
        setTooltip('No cell or selection available');
        setDisabled(true);
      }
    };

    // Initial state
    updateButtonState();

    // Listen to selection changes
    const onSelectionChanged = () => {
      updateButtonState();
    };
    selectionWatcher.selectionChanged.connect(onSelectionChanged);

    // Listen to active cell changes
    const onAvailabilityChanged = () => {
      updateButtonState();
    };
    activeCellManager.availabilityChanged.connect(onAvailabilityChanged);

    return () => {
      selectionWatcher.selectionChanged.disconnect(onSelectionChanged);
      activeCellManager.availabilityChanged.disconnect(onAvailabilityChanged);
    };
  }, [activeCellManager, selectionWatcher]);

  const onclick = () => {
    // Priority: selection first, then active cell
    const selection = selectionWatcher.selection;
    let codeToInsert = '';
    let language = '';

    if (selection?.text) {
      // Use text selection
      codeToInsert = selection.text;
      language = selection.language || '';
    } else if (activeCellManager.available) {
      // Use active cell content
      const cellContent = activeCellManager.getContent(false);
      if (cellContent) {
        codeToInsert = cellContent.source;
        language = cellContent.language || '';
      }
    }

    if (codeToInsert) {
      // Format as a code block and insert into the chat message
      const formattedCode = `\`\`\`${language}\n${codeToInsert}\n\`\`\``;

      // Append to current message value with a newline if there's existing content
      const currentValue = model.value;
      model.value = currentValue
        ? `${currentValue}\n\n${formattedCode}`
        : formattedCode;

      // Focus the input after inserting
      model.focus();
    }
  };

  return (
    <TooltippedButton
      onClick={onclick}
      tooltip={tooltip}
      buttonProps={{
        size: 'small',
        variant: 'text',
        title: tooltip,
        className: ATTACH_CODE_CELL_BUTTON_CLASS,
        disabled: disabled
      }}
      sx={{
        width: '24px',
        height: '24px',
        minWidth: '24px',
        color: disabled ? 'var(--jp-ui-font-color3)' : 'gray'
      }}
    >
      <CodeIcon sx={{ fontSize: '16px' }} />
    </TooltippedButton>
  );
}
