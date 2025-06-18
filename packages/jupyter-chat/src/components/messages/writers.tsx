/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box, Typography } from '@mui/material';
import React from 'react';

import { Avatar } from '../avatar';
import { IUser } from '../../types';

const WRITERS_CLASS = 'jp-chat-writers';

/**
 * The writers component props.
 */
type writersProps = {
  /**
   * The list of users currently writing.
   */
  writers: IUser[];
};

/**
 * Animated typing indicator component
 */
const TypingIndicator = (): JSX.Element => (
  <Box className="jp-chat-typing-indicator">
    <span className="jp-chat-typing-dot"></span>
    <span className="jp-chat-typing-dot"></span>
    <span className="jp-chat-typing-dot"></span>
  </Box>
);

/**
 * The writers component, displaying the current writers.
 */
export function Writers(props: writersProps): JSX.Element | null {
  const { writers } = props;

  // Don't render if no writers
  if (writers.length === 0) {
    return null;
  }

  const writersText = writers.length > 1 ? 'are writing' : 'is writing';

  return (
    <Box className={`${WRITERS_CLASS}`}>
      <Box className="jp-chat-writers-content">
        {writers.map((writer, index) => (
          <Box key={writer.username || index} className="jp-chat-writer-item">
            <Avatar user={writer} small />
            <Typography variant="body2" className="jp-chat-writer-name">
              {writer.display_name ??
                writer.name ??
                (writer.username || 'User undefined')}
            </Typography>
            {index < writers.length - 1 && (
              <Typography variant="body2" className="jp-chat-writer-separator">
                {index < writers.length - 2 ? ', ' : ' and '}
              </Typography>
            )}
          </Box>
        ))}
        <Box className="jp-chat-writing-status">
          <Typography variant="body2" className="jp-chat-writing-text">
            {writersText}
          </Typography>
          <TypingIndicator />
        </Box>
      </Box>
    </Box>
  );
}
