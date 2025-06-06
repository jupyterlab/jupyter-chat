/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box } from '@mui/material';
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
 * The writers component, displaying the current writers.
 */
export function Writers(props: writersProps): JSX.Element | null {
  const { writers } = props;
  return writers.length > 0 ? (
    <Box className={WRITERS_CLASS}>
      {writers.map((writer, index) => (
        <div>
          <Avatar user={writer} small />
          <span>
            {writer.display_name ??
              writer.name ??
              (writer.username || 'User undefined')}
          </span>
          <span>
            {index < writers.length - 1
              ? index < writers.length - 2
                ? ', '
                : ' and '
              : ''}
          </span>
        </div>
      ))}
      <span>{(writers.length > 1 ? ' are' : ' is') + ' writing'}</span>
    </Box>
  ) : null;
}
