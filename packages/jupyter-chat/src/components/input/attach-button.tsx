/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { FileDialog } from '@jupyterlab/filebrowser';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import React from 'react';

import { TooltippedButton } from '../mui-extras/tooltipped-button';
import { IInputModel } from '../../input-model';

const ATTACH_BUTTON_CLASS = 'jp-chat-attach-button';

/**
 * The attach button props.
 */
export type AttachButtonProps = {
  model: IInputModel;
};

/**
 * The attach button.
 */
export function AttachButton(props: AttachButtonProps): JSX.Element {
  const { model } = props;
  const tooltip = 'Add attachment';

  if (!model.documentManager || !model.addAttachment) {
    return <></>;
  }

  const onclick = async () => {
    if (!model.documentManager || !model.addAttachment) {
      return;
    }
    try {
      const files = await FileDialog.getOpenFiles({
        title: 'Select files to attach',
        manager: model.documentManager
      });
      if (files.value) {
        files.value.forEach(file => {
          if (file.type !== 'directory') {
            model.addAttachment?.({ type: 'file', value: file.path });
          }
        });
      }
    } catch (e) {
      console.warn('Error selecting files to attach', e);
    }
  };

  return (
    <TooltippedButton
      onClick={onclick}
      tooltip={tooltip}
      buttonProps={{
        size: 'small',
        variant: 'contained',
        title: tooltip,
        className: ATTACH_BUTTON_CLASS
      }}
      sx={{
        minWidth: 'unset',
        padding: '4px',
        borderRadius: '2px 0px 0px 2px',
        marginRight: '1px'
      }}
    >
      <AttachFileIcon />
    </TooltippedButton>
  );
}
