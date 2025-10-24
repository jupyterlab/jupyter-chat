/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { closeIcon } from '@jupyterlab/ui-components';
import React from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras/tooltipped-icon-button';

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
      className={CANCEL_BUTTON_CLASS}
      tooltip={tooltip}
      onClick={props.model.cancel}
      iconButtonProps={{
        sx: {
          marginLeft: 0,
          minWidth: '24px',
          width: '24px',
          height: '24px',
          padding: 0
        }
      }}
    >
      <closeIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}
