/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CancelIcon from '@mui/icons-material/Cancel';
import React from 'react';

import { TooltippedButton } from '../mui-extras/tooltipped-button';
import { IInputModel } from '../../input-model';

const CANCEL_BUTTON_CLASS = 'jp-chat-cancel-button';

/**
 * The cancel button props.
 */
export type CancelButtonProps = {
  model: IInputModel;
};

/**
 * The cancel button.
 */
export function CancelButton(props: CancelButtonProps): JSX.Element {
  if (!props.model.cancel) {
    return <></>;
  }
  const tooltip = 'Cancel edition';
  return (
    <TooltippedButton
      onClick={props.model.cancel}
      tooltip={tooltip}
      buttonProps={{
        size: 'small',
        variant: 'contained',
        title: tooltip,
        className: CANCEL_BUTTON_CLASS
      }}
      sx={{
        minWidth: 'unset',
        padding: '4px',
        borderRadius: '2px 0px 0px 2px',
        marginRight: '1px'
      }}
    >
      <CancelIcon />
    </TooltippedButton>
  );
}
