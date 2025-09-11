/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box, Typography } from '@mui/material';
import React, { useMemo } from 'react';

import { Avatar } from '../avatar';
import { IChatModel } from '../../model';
import { ISignal, Signal } from '@lumino/signaling';
import { IUser } from '../../types';

const WRITERS_CLASS = 'jp-chat-writers';
const WRITERS_ROW_CLASS = 'jp-chat-writers-row';

const DEFAULT_TEXT = 'is writing';

/**
 * The writers component props.
 */
type writersProps = {
  /**
   * The list of users currently writing.
   */
  writers: IChatModel.IWriter[];
  /**
   * The component to render next to the writers.
   */
  writerComponent?: WriterComponent;
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
export function WritingUsersList(props: writersProps): JSX.Element | null {
  const { writers, writerComponent } = props;

  // Don't render if no writers
  if (writers.length === 0) {
    return null;
  }

  // Default rendering for users without custom typing indicator and if there is no
  // component to add to the writing notification.
  const defaultWriters = writerComponent?.component
    ? []
    : writers.filter(writer => !writer.typingIndicator);
  const defaultWritersComponent = defaultWritingUsers({
    writers: defaultWriters.map(writer => writer.user)
  });

  // Custom rendering for users with custom typing indicator or if there is a component
  // to add to the writing notification.
  const customWriters = writerComponent?.component
    ? writers
    : writers.filter(writer => writer.typingIndicator);
  const customWritersComponent = customWritingUser({
    writers: customWriters,
    writerComponent: writerComponent?.component
  });

  return (
    <Box className={WRITERS_CLASS}>
      {defaultWritersComponent !== null && defaultWritersComponent}
      {customWritersComponent !== null && customWritersComponent}
    </Box>
  );
}

/**
 * The default rendering of writing users, all in a row.
 * This renderer is used if there is no custom component and no custom typing indicator.
 */
function defaultWritingUsers(props: { writers: IUser[] }): JSX.Element | null {
  const { writers } = props;

  // Don't render if no writers
  if (writers.length === 0) {
    return null;
  }

  const writersText = writers.length > 1 ? 'are writing' : DEFAULT_TEXT;

  const writingUsers: JSX.Element[] = useMemo(
    () =>
      writers.map((writer, index) => (
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
      )),
    [writers]
  );

  return (
    <Box className={`${WRITERS_ROW_CLASS}`}>
      <Box className="jp-chat-writers-content">
        {writingUsers}
        <Box className="jp-chat-writing-status">
          <Typography variant="body2" className="jp-chat-writing-text">
            {` ${writersText}`}
          </Typography>
          <TypingIndicator />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * The custom rendering of writing users, one per row.
 * This renderer is used if there is a custom component or a custom typing indicator.
 */
function customWritingUser(props: {
  writers: IChatModel.IWriter[];
  writerComponent?: React.FC<WriterComponentProps>;
}): JSX.Element | null {
  const { writers } = props;

  // Don't render if no writers
  if (writers.length === 0) {
    return null;
  }

  const writingUsers: JSX.Element[] = writers.map(writer => {
    const username =
      writer.user.display_name ??
      writer.user.name ??
      (writer.user.username || 'User undefined');

    const writerText = writer.typingIndicator ?? DEFAULT_TEXT;
    return (
      <Box key={writer.user.username} className="jp-chat-writer-item">
        <Avatar user={writer.user} small />
        <Typography variant="body2" className="jp-chat-writer-name">
          {username}
        </Typography>
        <Box className="jp-chat-writing-status">
          <Typography variant="body2" className="jp-chat-writing-text">
            {` ${writerText}`}
          </Typography>
          <TypingIndicator />
        </Box>
        {props.writerComponent && <props.writerComponent writer={writer} />}
      </Box>
    );
  });

  return (
    <>
      {writingUsers.map(writingUser => (
        <Box className={`${WRITERS_ROW_CLASS}`}>{writingUser}</Box>
      ))}
    </>
  );
}

export type WriterComponentProps = {
  /**
   * The writer associated to this component.
   */
  writer: IChatModel.IWriter;
};

/**
 * The writer component class containing a react component to display with the user
 * writing notification.
 */
export class WriterComponent {
  /**
   * The react component.
   */
  get component(): React.FC<WriterComponentProps> | undefined {
    return this._component;
  }
  set component(value: React.FC<WriterComponentProps> | undefined) {
    this._component = value;
    this._changed.emit(this._component);
  }

  /**
   * Emitting when the component changed.
   */
  get changed(): ISignal<
    WriterComponent,
    React.FC<WriterComponentProps> | undefined
  > {
    return this._changed;
  }

  private _component: React.FC<WriterComponentProps> | undefined;
  private _changed = new Signal<
    WriterComponent,
    React.FC<WriterComponentProps> | undefined
  >(this);
}
