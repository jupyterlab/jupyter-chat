/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { FileDialog } from '@jupyterlab/filebrowser';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import React from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras';

const ATTACH_BUTTON_CLASS = 'jp-chat-attach-button';

/**
 * The attach button.
 */
export function AttachButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
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
    <TooltippedIconButton
      onClick={onclick}
      tooltip={tooltip}
      buttonProps={{
        title: tooltip,
        className: ATTACH_BUTTON_CLASS
      }}
    >
      <AttachFileIcon />
    </TooltippedIconButton>
  );
}
