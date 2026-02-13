/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Box } from '@mui/material';
import React from 'react';

import { TooltippedIconButton } from '../mui-extras';

const TOOLBAR_CLASS = 'jp-chat-toolbar';

/**
 * The toolbar attached to a message.
 */
export function MessageToolbar(props: MessageToolbar.IProps): JSX.Element {
  const buttons: JSX.Element[] = [];

  if (props.edit !== undefined) {
    const editButton = (
      <TooltippedIconButton
        tooltip={'Edit'}
        onClick={props.edit}
        aria-label={'Edit'}
        inputToolbar={false}
      >
        <EditIcon />
      </TooltippedIconButton>
    );
    buttons.push(editButton);
  }
  if (props.delete !== undefined) {
    const deleteButton = (
      <TooltippedIconButton
        tooltip={'Delete'}
        onClick={props.delete}
        aria-label={'Delete'}
        inputToolbar={false}
      >
        <DeleteIcon />
      </TooltippedIconButton>
    );
    buttons.push(deleteButton);
  }

  return (
    <Box
      className={TOOLBAR_CLASS}
      sx={{
        display: 'flex',
        gap: 2
      }}
    >
      {buttons}
    </Box>
  );
}

export namespace MessageToolbar {
  export interface IProps {
    edit?: () => void;
    delete?: () => void;
  }
}
