/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box, Typography } from '@mui/material';
import React from 'react';

import { IChatModel } from '../../model';

/**
 * The input writing indicator component props.
 */
export interface IInputWritingIndicatorProps {
  /**
   * The list of users currently writing.
   */
  writers: IChatModel.IWriter[];
}

/**
 * Format the writers list into a readable string.
 * Examples: "Alice is typing...", "Alice and Bob are typing...", "Alice, Bob, and Carol are typing..."
 */
function formatWritersText(writers: IChatModel.IWriter[]): string {
  if (writers.length === 0) {
    return '';
  }

  const names = writers.map(
    w => w.user.display_name ?? w.user.name ?? w.user.username ?? 'Unknown'
  );

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  } else {
    const allButLast = names.slice(0, -1).join(', ');
    const last = names[names.length - 1];
    return `${allButLast}, and ${last} are typing...`;
  }
}

/**
 * The input writing indicator component, displaying typing status in the chat input area.
 */
export function InputWritingIndicator(
  props: IInputWritingIndicatorProps
): JSX.Element {
  const { writers } = props;

  // Always render the container to reserve space, even if no writers
  const writersText = writers.length > 0 ? formatWritersText(writers) : '';

  return (
    <Box
      sx={{
        minHeight: '16px'
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'var(--jp-ui-font-color2)',
          display: 'block',
          fontSize: '10px',
          fontFamily: 'var(--jp-ui-font-family)',
          lineHeight: '16px',
          visibility: writers.length > 0 ? 'visible' : 'hidden'
        }}
      >
        {writersText || '\u00A0'}
      </Typography>
    </Box>
  );
}
