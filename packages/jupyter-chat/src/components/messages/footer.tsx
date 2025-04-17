/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Box } from '@mui/material';
import React from 'react';
import {
  IMessageFooterRegistry,
  MessageFooterSectionProps
} from '../../footers';

/**
 * The chat footer component properties.
 */
export interface IMessageFootersProps extends MessageFooterSectionProps {
  /**
   * The chat footer registry.
   */
  registry: IMessageFooterRegistry;
}

/**
 * The chat footer component, which displays footer components on a row according to
 * their respective positions.
 */
export function MessageFooter(props: IMessageFootersProps): JSX.Element {
  const { message, model, registry } = props;
  const footer = registry.getFooter();

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
