/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

// import { IDocumentManager } from '@jupyterlab/docmanager';
import CloseIcon from '@mui/icons-material/Close';
import { Box } from '@mui/material';
import React, { useContext } from 'react';

import { TooltippedButton } from './mui-extras/tooltipped-button';
import { IAttachment } from '../types';
import { AttachmentOpenerContext } from '../context';

const ATTACHMENTS_CLASS = 'jp-chat-attachments';
const ATTACHMENT_CLASS = 'jp-chat-attachment';
const ATTACHMENT_CLICKABLE_CLASS = 'jp-chat-attachment-clickable';
const REMOVE_BUTTON_CLASS = 'jp-chat-attachment-remove';

/**
 * The attachments props.
 */
export type AttachmentsProps = {
  attachments: IAttachment[];
  onRemove?: (attachment: IAttachment) => void;
};

/**
 * The Attachments component.
 */
export function AttachmentPreviewList(props: AttachmentsProps): JSX.Element {
  return (
    <Box className={ATTACHMENTS_CLASS}>
      {props.attachments.map(attachment => (
        <AttachmentPreview {...props} attachment={attachment} />
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
export function AttachmentPreview(props: AttachmentProps): JSX.Element {
  const remove_tooltip = 'Remove attachment';
  const attachmentOpenerRegistry = useContext(AttachmentOpenerContext);

  return (
    <Box className={ATTACHMENT_CLASS}>
      <span
        className={
          attachmentOpenerRegistry?.get(props.attachment.type)
            ? ATTACHMENT_CLICKABLE_CLASS
            : ''
        }
        onClick={() =>
          attachmentOpenerRegistry?.get(props.attachment.type)?.(
            props.attachment
          )
        }
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
