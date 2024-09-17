import CancelIcon from '@mui/icons-material/Cancel';
import React from 'react';
import { TooltippedButton } from '../mui-extras/tooltipped-button';

const CANCEL_BUTTON_CLASS = 'jp-chat-cancel-button';

/**
 * The cancel button props.
 */
export type CancelButtonProps = {
  inputExists: boolean;
  onCancel: () => void;
};

/**
 * The cancel button.
 */
export function CancelButton(props: CancelButtonProps): JSX.Element {
  const tooltip = 'Cancel edition';
  const disabled = !props.inputExists;
  return (
    <TooltippedButton
      onClick={props.onCancel}
      disabled={disabled}
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
