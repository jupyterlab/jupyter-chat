/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box } from '@mui/material';
import React from 'react';

import { useChatContext } from '../../context';
import { IChatMessage } from '../../types';

/**
 * The chat footer component properties.
 */
export interface IMessageFootersProps {
  /**
   * The chat model.
   */
  message: IChatMessage;
}

/**
 * The chat footer component, which displays footer components on a row according to
 * their respective positions.
 */
export function MessageFooterComponent(
  props: IMessageFootersProps
): JSX.Element | null {
  const { message } = props;
  const { model, messageFooterRegistry } = useChatContext();
  if (!messageFooterRegistry) {
    return null;
  }
  const footer = messageFooterRegistry.getFooter();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      {footer.left?.component ? (
        <footer.left.component message={message} model={model} />
      ) : (
        <div />
      )}
      {footer.center?.component ? (
        <footer.center.component message={message} model={model} />
      ) : (
        <div />
      )}
      {footer.right?.component ? (
        <footer.right.component message={message} model={model} />
      ) : (
        <div />
      )}
    </Box>
  );
}
