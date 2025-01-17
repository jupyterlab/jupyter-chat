/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IDocumentManager } from '@jupyterlab/docmanager';
import { FileDialog } from '@jupyterlab/filebrowser';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import React from 'react';

import { TooltippedButton } from '../mui-extras/tooltipped-button';
import { IAttachment } from '../../types';

const ATTACH_BUTTON_CLASS = 'jp-chat-attach-button';

/**
 * The attach button props.
 */
export type AttachButtonProps = {
  documentManager: IDocumentManager;
  onAttach: (attachment: IAttachment) => void;
};

/**
 * The attach button.
 */
export function AttachButton(props: AttachButtonProps): JSX.Element {
  const tooltip = 'Add attachment';

  const onclick = async () => {
    FileDialog.getOpenFiles({
      title: 'Select files to attach',
      manager: props.documentManager
    })
      .then(result => {
        if (result.value) {
          result.value.forEach(file => {
            if (file.type !== 'directory') {
              props.onAttach({ type: 'file', value: file.path });
            }
          });
        }
      })
      .catch(e => {
        console.warn('Error selecting files to attach', e);
      });
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
