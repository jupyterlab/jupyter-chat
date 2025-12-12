/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CloseIcon from '@mui/icons-material/Close';
import React from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras';

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
    <TooltippedIconButton
      onClick={props.model.cancel}
      tooltip={tooltip}
      buttonProps={{
        title: tooltip,
        className: CANCEL_BUTTON_CLASS
      }}
    >
      <CloseIcon />
    </TooltippedIconButton>
  );
}
