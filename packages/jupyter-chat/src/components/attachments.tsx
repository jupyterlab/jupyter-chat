/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

// import { IDocumentManager } from '@jupyterlab/docmanager';
import CloseIcon from '@mui/icons-material/Close';
import { Box } from '@mui/material';
import React from 'react';

import { TooltippedButton } from './mui-extras/tooltipped-button';
import { IAttachment } from '../types';

const ATTACHMENTS_CLASS = 'jp-chat-attachments';
const ATTACHMENT_CLASS = 'jp-chat-attachment';
const REMOVE_BUTTON_CLASS = 'jp-chat-attachment-remove';

/**
 * The attachments props.
 */
export type AttachmentsProps = {
  attachments: IAttachment[];
  onRemove: (attachment: IAttachment) => void;
};

/**
 * The Attachments component.
 */
export function AttachmentsComponent(props: AttachmentsProps): JSX.Element {
  return (
    <Box className={ATTACHMENTS_CLASS}>
      {props.attachments.map(attachment => (
        <AttachmentComponent
          attachment={attachment}
          onRemove={props.onRemove}
        />
      ))}
    </Box>
  );
}

/**
 * The attachment props.
 */
export type AttachmentProps = {
  attachment: IAttachment;
  onRemove: (attachment: IAttachment) => void;
};
export function AttachmentComponent(props: AttachmentProps): JSX.Element {
  const tooltip = 'Remove attachment';
  return (
    <Box className={ATTACHMENT_CLASS}>
      {props.attachment.value}
      <TooltippedButton
        onClick={() => props.onRemove(props.attachment)}
        tooltip={tooltip}
        buttonProps={{
          size: 'small',
          title: tooltip,
          className: REMOVE_BUTTON_CLASS
        }}
        sx={{
          minWidth: 'unset',
          padding: '0',
          color: 'inherit'
        }}
      >
        <CloseIcon />
      </TooltippedButton>
    </Box>
  );
}
