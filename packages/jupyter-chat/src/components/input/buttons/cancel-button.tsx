/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Tooltip } from '@mui/material';
import React from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';

const CANCEL_BUTTON_CLASS = 'jp-chat-cancel-button';

/**
 * The cancel button.
 */
export function CancelButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
  if (!props.model.cancel) {
    return <></>;
  }
  const tooltip = 'Cancel editing';
  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <span>
        <IconButton
          onClick={props.model.cancel}
          className={CANCEL_BUTTON_CLASS}
          aria-label={tooltip}
          sx={{
            width: '24px',
            height: '24px',
            padding: 0,
            lineHeight: 0
          }}
        >
          <CloseIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
