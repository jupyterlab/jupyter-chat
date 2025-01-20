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
const ATTACHMENT_CLICKABLE_CLASS = 'jp-chat-attachment-clickable';
const REMOVE_BUTTON_CLASS = 'jp-chat-attachment-remove';

/**
 * The attachments props.
 */
export type AttachmentsProps = {
  attachments: IAttachment[];
  onClick?: (attachment: IAttachment) => void;
  onRemove?: (attachment: IAttachment) => void;
};

/**
 * The Attachments component.
 */
export function AttachmentsComponent(props: AttachmentsProps): JSX.Element {
  return (
    <Box className={ATTACHMENTS_CLASS}>
      {props.attachments.map(attachment => (
        <AttachmentComponent {...props} attachment={attachment} />
      ))}
    </Box>
  );
}

/**
 * The attachment props.
 */
export type AttachmentProps = AttachmentsProps & {
  attachment: IAttachment;
};

/**
 * The Attachment component.
 */
export function AttachmentComponent(props: AttachmentProps): JSX.Element {
  const remove_tooltip = 'Remove attachment';

  const onclick = () => {
    if (props.onClick) {
      props.onClick(props.attachment);
    }
  };

  return (
    <Box className={ATTACHMENT_CLASS}>
      <span
        className={props.onClick ? ATTACHMENT_CLICKABLE_CLASS : ''}
        onClick={onclick}
      >
        {props.attachment.value}
      </span>
      {props.onRemove && (
        <TooltippedButton
          onClick={() => props.onRemove!(props.attachment)}
          tooltip={remove_tooltip}
          buttonProps={{
            size: 'small',
            title: remove_tooltip,
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
      )}
    </Box>
  );
}
