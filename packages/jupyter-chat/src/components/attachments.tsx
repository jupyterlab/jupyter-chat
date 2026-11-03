/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CloseIcon from '@mui/icons-material/Close';
import { Box, Tooltip } from '@mui/material';
import React from 'react';
import { PathExt } from '@jupyterlab/coreutils';
import { UUID } from '@lumino/coreutils';

import { TooltippedIconButton } from './mui-extras';
import { useChatContext, useTranslator } from '../context';
import { IAttachment, PendingSnippet } from '../types';

const ATTACHMENT_CLASS = 'jp-chat-attachment';
const ATTACHMENT_CLICKABLE_CLASS = 'jp-chat-attachment-clickable';
const REMOVE_BUTTON_CLASS = 'jp-chat-attachment-remove';
const PENDING_SNIPPET_CLASS = 'jp-chat-pending-snippet';
const PENDING_SNIPPET_REMOVE_CLASS = 'jp-chat-pending-snippet-remove';

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
  const trans = useTranslator();
  const { attachmentOpenerRegistry } = useChatContext();
  const isClickable = !!attachmentOpenerRegistry?.get(props.attachment.type);

  return (
    <Box
      className={ATTACHMENT_CLASS}
      sx={{
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '2px',
        px: 1,
        py: 0.5,
        backgroundColor: 'var(--jp-layout-color2)',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: '0.8125rem'
      }}
    >
      <Tooltip title={props.attachment.value} placement="top" arrow>
        <Box
          className={
            attachmentOpenerRegistry?.get(props.attachment.type)
              ? ATTACHMENT_CLICKABLE_CLASS
              : ''
          }
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
      </Tooltip>
      {props.onRemove && (
        <TooltippedIconButton
          tooltip={trans.__('Remove attachment')}
          onClick={() => props.onRemove!(props.attachment)}
          className={REMOVE_BUTTON_CLASS}
          inputToolbar={false}
          sx={{
            width: 'unset',
            minWidth: 'unset',
            height: 'unset',
            padding: 0
          }}
        >
          <CloseIcon fontSize="small" />
        </TooltippedIconButton>
      )}
    </Box>
  );
}

/**
 * The key of a chip: the identity of its snippet, which is also what removal
 * matches on, so a chip keeps its key when another one is removed.
 */
const snippetKeys = new WeakMap<PendingSnippet, number>();
let nextSnippetKey = 0;

function snippetKey(snippet: PendingSnippet): number {
  let key = snippetKeys.get(snippet);
  if (key === undefined) {
    key = nextSnippetKey++;
    snippetKeys.set(snippet, key);
  }
  return key;
}

export type PendingSnippetsProps = {
  snippets: PendingSnippet[];
  onRemove?: (snippet: PendingSnippet) => void;
};

/**
 * The list of the selections staged in the input.
 */
export function PendingSnippetPreviewList(
  props: PendingSnippetsProps
): JSX.Element {
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
      {props.snippets.map(snippet => (
        <PendingSnippetPreview
          key={snippetKey(snippet)}
          snippet={snippet}
          onRemove={props.onRemove}
        />
      ))}
    </Box>
  );
}

/**
 * The preview of a selection staged in the input: path, cell and lines.
 */
export function PendingSnippetPreview(props: {
  snippet: PendingSnippet;
  onRemove?: (snippet: PendingSnippet) => void;
}): JSX.Element {
  const trans = useTranslator();
  const { path, cellId, selection } = props.snippet;
  const label = [
    PathExt.basename(path) || path,
    ...(cellId ? [trans.__('cell %1', cellId.slice(0, 8))] : []),
    trans.__('lines %1-%2', selection.start[0] + 1, selection.end[0] + 1)
  ].join(' \u00b7 ');

  return (
    <Box
      className={PENDING_SNIPPET_CLASS}
      sx={{
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '2px',
        px: 1,
        py: 0.5,
        backgroundColor: 'var(--jp-layout-color2)',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: '0.8125rem'
      }}
    >
      <Tooltip title={path} placement="top" arrow>
        <Box component="span">{label}</Box>
      </Tooltip>
      {props.onRemove && (
        <TooltippedIconButton
          tooltip={trans.__('Remove from message')}
          onClick={() => props.onRemove!(props.snippet)}
          className={PENDING_SNIPPET_REMOVE_CLASS}
          inputToolbar={false}
          sx={{
            width: 'unset',
            minWidth: 'unset',
            height: 'unset',
            padding: 0
          }}
        >
          <CloseIcon fontSize="small" />
        </TooltippedIconButton>
      )}
    </Box>
  );
}
