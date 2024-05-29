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
import { ScrollContainer } from './scroll-container';
import { IChatModel } from '../model';
import { IChatMessage } from '../types';

const MESSAGES_BOX_CLASS = 'jp-chat-messages-container';
const MESSAGE_CLASS = 'jp-chat-message';
const MESSAGE_STACKED_CLASS = 'jp-chat-message-stacked';
const MESSAGE_HEADER_CLASS = 'jp-chat-message-header';
const MESSAGE_TIME_CLASS = 'jp-chat-message-time';

/**
 * The base components props.
 */
type BaseMessageProps = {
  rmRegistry: IRenderMimeRegistry;
  model: IChatModel;
};

/**
 * The messages list component.
 */
export function ChatMessages(props: BaseMessageProps): JSX.Element {
  const { model } = props;
  const [messages, setMessages] = useState<IChatMessage[]>([]);

  /**
   * Effect: fetch history and config on initial render
   */
  useEffect(() => {
    async function fetchHistory() {
      if (!model.getHistory) {
        return;
      }
      model
        .getHistory()
        .then(history => setMessages(history.messages))
        .catch(e => console.error(e));
    }

    fetchHistory();
  }, [model]);

  /**
   * Effect: listen to chat messages.
   */
  useEffect(() => {
    function handleChatEvents(_: IChatModel) {
      setMessages([...model.messages]);
    }

    model.messagesUpdated.connect(handleChatEvents);
    return function cleanup() {
      model.messagesUpdated.disconnect(handleChatEvents);
    };
  }, [model]);

  return (
    <ScrollContainer sx={{ flexGrow: 1 }}>
      <Box className={clsx(MESSAGES_BOX_CLASS)}>
        {messages.map((message, i) => {
          return (
            // extra div needed to ensure each bubble is on a new line
            <Box
              key={i}
              className={clsx(
                MESSAGE_CLASS,
                message.stacked ? MESSAGE_STACKED_CLASS : ''
              )}
            >
              <ChatMessageHeader message={message} />
              <ChatMessage {...props} message={message} />
            </Box>
          );
        })}
      </Box>
    </ScrollContainer>
  );
}

/**
 * The message header props.
 */
type ChatMessageHeaderProps = {
  message: IChatMessage;
  sx?: SxProps<Theme>;
};

/**
 * The message header component.
 */
export function ChatMessageHeader(props: ChatMessageHeaderProps): JSX.Element {
  const [datetime, setDatetime] = useState<Record<number, string>>({});
  const sharedStyles: SxProps<Theme> = {
    height: '24px',
    width: '24px'
  };
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

  const bgcolor = sender.color;
  const avatar = message.stacked ? null : sender.avatar_url ? (
    <Avatar
      sx={{
        ...sharedStyles,
        ...(bgcolor && { bgcolor })
      }}
      src={sender.avatar_url}
    ></Avatar>
  ) : sender.initials ? (
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
        {sender.initials}
      </Typography>
    </Avatar>
  ) : null;

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
        marginBottom: message.stacked ? '0px' : '12px',
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

/**
 * The message component props.
 */
type ChatMessageProps = BaseMessageProps & {
  /**
   * The message to display.
   */
  message: IChatMessage;
};

/**
 * The message component body.
 */
export function ChatMessage(props: ChatMessageProps): JSX.Element {
  const { message, model, rmRegistry } = props;
  const [edit, setEdit] = useState<boolean>(false);
  const [deleted, setDeleted] = useState<boolean>(false);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [canDelete, setCanDelete] = useState<boolean>(false);

  // Look if the message can be deleted or edited.
  useEffect(() => {
    setDeleted(message.deleted ?? false);
    if (model.user !== undefined && !message.deleted) {
      if (model.user.username === message.sender.username) {
        setCanEdit(model.updateMessage !== undefined);
        setCanDelete(model.deleteMessage !== undefined);
      }
    } else {
      setCanEdit(false);
      setCanDelete(false);
    }
  }, [model, message]);

  // Cancel the current edition of the message.
  const cancelEdition = (): void => {
    setEdit(false);
  };

  // Update the content of the message.
  const updateMessage = (id: string, input: string): void => {
    if (!canEdit) {
      return;
    }
    // Update the message
    const updatedMessage = { ...message };
    updatedMessage.body = input;
    model.updateMessage!(id, updatedMessage);
    setEdit(false);
  };

  // Delete the message.
  const deleteMessage = (id: string): void => {
    if (!canDelete) {
      return;
    }
    model.deleteMessage!(id);
  };

  // Empty if the message has been deleted
  return deleted ? (
    <></>
  ) : (
    <div>
      {edit && canEdit ? (
        <ChatInput
          value={message.body}
          onSend={(input: string) => updateMessage(message.id, input)}
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
