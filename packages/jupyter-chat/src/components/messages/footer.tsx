/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box } from '@mui/material';
import React from 'react';
import { IChatMessageFooterProps, IChatFooterRegistry } from '../../footers';

/**
 * The chat footer component properties.
 */
export interface IChatFootersProps extends IChatMessageFooterProps {
  /**
   * The chat footer registry.
   */
  registry: IChatFooterRegistry;
}

/**
 * The chat footer component, which displays footer components on a row according to
 * their respective positions.
 */
export function ChatFooters(props: IChatFootersProps): JSX.Element {
  const { message, model, registry } = props;
  const footers = registry.get();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      {footers.left?.component ? (
        <footers.left.component message={message} model={model} />
      ) : (
        <div />
      )}
      {footers.center?.component ? (
        <footers.center.component message={message} model={model} />
      ) : (
        <div />
      )}
      {footers.right?.component ? (
        <footers.right.component message={message} model={model} />
      ) : (
        <div />
      )}
    </Box>
  );
}
