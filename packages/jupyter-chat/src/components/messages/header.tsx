/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { Avatar } from '../avatar';
import { IChatMessage } from '../../types';

const MESSAGE_HEADER_CLASS = 'jp-chat-message-header';
const MESSAGE_TIME_CLASS = 'jp-chat-message-time';

/**
 * The message header props.
 */
type ChatMessageHeaderProps = {
  /**
   * The chat message.
   */
  message: IChatMessage;
};

/**
 * The message header component.
 */
export function ChatMessageHeader(props: ChatMessageHeaderProps): JSX.Element {
  const [datetime, setDatetime] = useState<Record<number, string>>({});
  const message = props.message;
  const sender = message.sender;
  /**
   * Effect: update cached datetime strings upon receiving a new message.
   */
  useEffect(() => {
    if (!datetime[message.time]) {
      const newDatetime: Record<number, string> = {};
      let datetime: string;
      const currentDate = new Date();
      const sameDay = (date: Date) =>
        date.getFullYear() === currentDate.getFullYear() &&
        date.getMonth() === currentDate.getMonth() &&
        date.getDate() === currentDate.getDate();

      const msgDate = new Date(message.time * 1000); // Convert message time to milliseconds

      // Display only the time if the day of the message is the current one.
      if (sameDay(msgDate)) {
        // Use the browser's default locale
        datetime = msgDate.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        });
      } else {
        // Use the browser's default locale
        datetime = msgDate.toLocaleString([], {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }
      newDatetime[message.time] = datetime;
      setDatetime(newDatetime);
    }
  });

  const avatar = message.stacked ? null : Avatar({ user: sender });

  const name =
    sender.display_name ?? sender.name ?? (sender.username || 'User undefined');

  return (
    <Box
      className={MESSAGE_HEADER_CLASS}
      sx={{
        display: 'flex',
        alignItems: 'center',
        '& > :not(:last-child)': {
          marginRight: 3
        },
        marginBottom: message.stacked ? '0px' : '12px'
      }}
    >
      {avatar}
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!message.stacked && (
            <Typography
              sx={{
                fontWeight: 700,
                color: 'var(--jp-ui-font-color1)',
                paddingRight: '0.5em'
              }}
            >
              {name}
            </Typography>
          )}
          {(message.deleted || message.edited) && (
            <Typography
              sx={{
                fontStyle: 'italic',
                fontSize: 'var(--jp-content-font-size0)'
              }}
            >
              {message.deleted ? '(message deleted)' : '(edited)'}
            </Typography>
          )}
        </Box>
        <Typography
          className={MESSAGE_TIME_CLASS}
          sx={{
            fontSize: '0.8em',
            color: 'var(--jp-ui-font-color2)',
            fontWeight: 300
          }}
          title={message.raw_time ? 'Unverified time' : ''}
        >
          {`${datetime[message.time]}${message.raw_time ? '*' : ''}`}
        </Typography>
      </Box>
    </Box>
  );
}
