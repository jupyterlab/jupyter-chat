/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Avatar as MuiAvatar, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import React from 'react';

import { IUser } from '../types';

/**
 * The avatar props.
 */
type AvatarProps = {
  /**
   * The user to display an avatar.
   */
  user: IUser;
  /**
   * Whether the avatar should be small.
   */
  small?: boolean;
};

/**
 * The avatar component.
 */
export function Avatar(props: AvatarProps): JSX.Element | null {
  const { user } = props;

  const sharedStyles: SxProps<Theme> = {
    height: `${props.small ? '16' : '24'}px`,
    width: `${props.small ? '16' : '24'}px`,
    bgcolor: user.color,
    fontSize: `var(--jp-ui-font-size${props.small ? '0' : '1'})`
  };

  const name =
    user.display_name ?? user.name ?? (user.username || 'User undefined');
  return user.avatar_url ? (
    <MuiAvatar
      sx={{
        ...sharedStyles
      }}
      src={user.avatar_url}
      alt={name}
      title={name}
    ></MuiAvatar>
  ) : user.initials ? (
    <MuiAvatar
      sx={{
        ...sharedStyles
      }}
      alt={name}
      title={name}
    >
      <Typography
        sx={{
          fontSize: `var(--jp-ui-font-size${props.small ? '0' : '1'})`,
          color: 'var(--jp-ui-inverse-font-color1)'
        }}
      >
        {user.initials}
      </Typography>
    </MuiAvatar>
  ) : null;
}
