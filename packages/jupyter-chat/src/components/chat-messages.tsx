/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Avatar, Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import clsx from 'clsx';
import React, { useState, useEffect } from 'react';

import { ChatInput } from './chat-input';
import { RendermimeMarkdown } from './rendermime-markdown';
import { IChatModel } from '../model';
import { IChatMessage, IUser } from '../types';

const MESSAGES_BOX_CLASS = 'jp-chat-messages-container';
const MESSAGE_CLASS = 'jp-chat-message';
const MESSAGE_HEADER_CLASS = 'jp-chat-message-header';
const MESSAGE_TIME_CLASS = 'jp-chat-message-time';

type BaseMessageProps = {
  rmRegistry: IRenderMimeRegistry;
  model: IChatModel;
};

type ChatMessageProps = BaseMessageProps & {
  message: IChatMessage;
};

type ChatMessagesProps = BaseMessageProps & {
  messages: IChatMessage[];
};

export type ChatMessageHeaderProps = IUser & {
  timestamp: string;
  rawTime?: boolean;
  deleted?: boolean;
  edited?: boolean;
  sx?: SxProps<Theme>;
};

export function ChatMessageHeader(props: ChatMessageHeaderProps): JSX.Element {
  const sharedStyles: SxProps<Theme> = {
    height: '24px',
    width: '24px'
  };

  const bgcolor = props.color;
  const avatar = props.avatar_url ? (
    <Avatar
      sx={{
        ...sharedStyles,
        ...(bgcolor && { bgcolor })
      }}
      src={props.avatar_url}
    ></Avatar>
  ) : props.initials ? (
    <Avatar
      sx={{
        ...sharedStyles,
        ...(bgcolor && { bgcolor })
      }}
    >
      <Typography
        sx={{
          fontSize: 'var(--jp-ui-font-size1)',
          color: 'var(--jp-ui-inverse-font-color1)'
        }}
      >
        {props.initials}
      </Typography>
    </Avatar>
  ) : null;

  const name =
    props.display_name ?? props.name ?? (props.username || 'User undefined');

  return (
    <Box
      className={MESSAGE_HEADER_CLASS}
      sx={{
        display: 'flex',
        alignItems: 'center',
        '& > :not(:last-child)': {
          marginRight: 3
        },
        ...props.sx
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
          <Typography
            sx={{ fontWeight: 700, color: 'var(--jp-ui-font-color1)' }}
          >
            {name}
          </Typography>
          {(props.deleted || props.edited) && (
            <Typography
              sx={{
                fontStyle: 'italic',
                fontSize: 'var(--jp-content-font-size0)',
                paddingLeft: '0.5em'
              }}
            >
              {props.deleted ? '(message deleted)' : '(edited)'}
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
          title={props.rawTime ? 'Unverified time' : ''}
        >
          {`${props.timestamp}${props.rawTime ? '*' : ''}`}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * The messages list UI.
 */
export function ChatMessages(props: ChatMessagesProps): JSX.Element {
  const [timestamps, setTimestamps] = useState<Record<string, string>>({});

  /**
   * Effect: update cached timestamp strings upon receiving a new message.
   */
  useEffect(() => {
    const newTimestamps: Record<string, string> = { ...timestamps };
    let timestampAdded = false;

    const currentDate = new Date();
    const sameDay = (date: Date) =>
      date.getFullYear() === currentDate.getFullYear() &&
      date.getMonth() === currentDate.getMonth() &&
      date.getDate() === currentDate.getDate();

    for (const message of props.messages) {
      if (!(message.id in newTimestamps)) {
        const date = new Date(message.time * 1000); // Convert message time to milliseconds

        // Display only the time if the day of the message is the current one.
        if (sameDay(date)) {
          // Use the browser's default locale
          newTimestamps[message.id] = date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          });
        } else {
          // Use the browser's default locale
          newTimestamps[message.id] = date.toLocaleString([], {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
        }

        timestampAdded = true;
      }
    }
    if (timestampAdded) {
      setTimestamps(newTimestamps);
    }
  }, [props.messages]);

  return (
    <Box
      sx={{
        '& > :not(:last-child)': {
          borderBottom: '1px solid var(--jp-border-color2)'
        }
      }}
      className={clsx(MESSAGES_BOX_CLASS)}
    >
      {props.messages.map((message, i) => {
        let sender: IUser;
        if (typeof message.sender === 'string') {
          sender = { username: message.sender };
        } else {
          sender = message.sender;
        }
        return (
          // extra div needed to ensure each bubble is on a new line
          <Box
            key={i}
            sx={{ padding: '1em 1em 0 1em' }}
            className={clsx(MESSAGE_CLASS)}
          >
            <ChatMessageHeader
              {...sender}
              timestamp={timestamps[message.id]}
              rawTime={message.raw_time}
              deleted={message.deleted}
              edited={message.edited}
              sx={{ marginBottom: 3 }}
            />
            <ChatMessage {...props} message={message} />
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * the message UI.
 */
export function ChatMessage(props: ChatMessageProps): JSX.Element {
  const { message, model, rmRegistry } = props;
  let canEdit = false;
  let canDelete = false;
  if (model.user !== undefined && !message.deleted) {
    const username =
      typeof message.sender === 'string'
        ? message.sender
        : message.sender.username;

    if (model.user.username === username && model.updateMessage !== undefined) {
      canEdit = true;
    }
    if (model.user.username === username && model.deleteMessage !== undefined) {
      canDelete = true;
    }
  }
  const [edit, setEdit] = useState<boolean>(false);
  const [input, setInput] = useState(message.body);

  const cancelEdition = (): void => {
    setInput(message.body);
    setEdit(false);
  };

  const updateMessage = (id: string): void => {
    if (!canEdit) {
      return;
    }
    // Update the message
    const updatedMessage = { ...message };
    updatedMessage.body = input;
    model.updateMessage!(id, updatedMessage);
    setEdit(false);
  };

  const deleteMessage = (id: string): void => {
    if (!canDelete) {
      return;
    }
    // Delete the message
    model.deleteMessage!(id);
  };

  // Empty if the message has been deleted
  return message.deleted ? (
    <></>
  ) : (
    <div>
      {edit && canEdit ? (
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => updateMessage(message.id)}
          onCancel={() => cancelEdition()}
          sendWithShiftEnter={model.config.sendWithShiftEnter ?? false}
        />
      ) : (
        <RendermimeMarkdown
          rmRegistry={rmRegistry}
          markdownStr={message.body}
          edit={canEdit ? () => setEdit(true) : undefined}
          delete={canDelete ? () => deleteMessage(message.id) : undefined}
        />
      )}
    </div>
  );
}
