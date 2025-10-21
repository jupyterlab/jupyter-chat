/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CloseIcon from '@mui/icons-material/Close';
import { Box } from '@mui/material';
import React, { useContext } from 'react';
import { PathExt } from '@jupyterlab/coreutils';
import { UUID } from '@lumino/coreutils';

import { ContrastingTooltip } from './mui-extras/contrasting-tooltip';
import { TooltippedButton } from './mui-extras/tooltipped-button';
import { IAttachment } from '../types';
import { AttachmentOpenerContext } from '../context';

const REMOVE_BUTTON_CLASS = 'jp-chat-attachment-remove';

/**
 * Generate a user-friendly display name for an attachment
 */
function getAttachmentDisplayName(attachment: IAttachment): string {
  if (attachment.type === 'notebook') {
    // Extract notebook filename with extension
    const notebookName =
      PathExt.basename(attachment.value) || 'Unknown notebook';

    // Show info about attached cells if there are any
    if (attachment.cells?.length === 1) {
      return `${notebookName}: ${attachment.cells[0].input_type} cell`;
    } else if (attachment.cells && attachment.cells.length > 1) {
      return `${notebookName}: ${attachment.cells.length} cells`;
    }

    return notebookName;
  }

  if (attachment.type === 'file') {
    // Extract filename with extension
    const fileName = PathExt.basename(attachment.value) || 'Unknown file';

    return fileName;
  }

  return (attachment as any).value || 'Unknown attachment';
}

export type AttachmentsProps = {
  attachments: IAttachment[];
  onRemove?: (attachment: IAttachment) => void;
};

/**
 * The Attachments component.
 */
export function AttachmentPreviewList(props: AttachmentsProps): JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        rowGap: 1,
        columnGap: 2
      }}
    >
      {props.attachments.map(attachment => (
        <AttachmentPreview
          key={`${PathExt.basename(attachment.value)}-${UUID.uuid4()}`}
          {...props}
          attachment={attachment}
        />
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
  const isClickable = !!attachmentOpenerRegistry?.get(props.attachment.type);

  return (
    <Box
      sx={{
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '2px',
        px: 1,
        py: 0.5,
        backgroundColor: 'var(--jp-layout-color0)',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: '0.8125rem'
      }}
    >
      <ContrastingTooltip title={props.attachment.value} placement="top">
        <Box
          component="span"
          onClick={() =>
            attachmentOpenerRegistry?.get(props.attachment.type)?.(
              props.attachment
            )
          }
          sx={{
            cursor: isClickable ? 'pointer' : 'default',
            '&:hover': isClickable
              ? {
                  textDecoration: 'underline'
                }
              : {}
          }}
        >
          {getAttachmentDisplayName(props.attachment)}
        </Box>
      </ContrastingTooltip>
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
            padding: 0,
            color: 'var(--jp-ui-font-color2)',
            '&:hover': {
              color: 'var(--jp-ui-font-color0)',
              backgroundColor: 'transparent'
            }
          }}
        >
          <CloseIcon fontSize="small" />
        </TooltippedButton>
      )}
    </Box>
  );
}
