/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useMemo } from 'react';
import { Box, SxProps, Theme } from '@mui/material';

type ScrollContainerProps = {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
};

/**
 * Component that handles intelligent scrolling.
 *
 * - If viewport is at the bottom of the overflow container, appending new
 * children keeps the viewport on the bottom of the overflow container.
 *
 * - If viewport is in the middle of the overflow container, appending new
 * children leaves the viewport unaffected.
 *
 * Currently only works for Chrome and Firefox due to reliance on
 * `overflow-anchor`.
 *
 * **References**
 * - https://css-tricks.com/books/greatest-css-tricks/pin-scrolling-to-bottom/
 */
export function ScrollContainer(props: ScrollContainerProps): JSX.Element {
  const id = useMemo(
    () => 'jupyter-chat-scroll-container-' + Date.now().toString(),
    []
  );

  return (
    <Box
      id={id}
      sx={{
        overflowY: 'scroll',
        '& *': {
          overflowAnchor: 'none'
        },
        ...props.sx
      }}
    >
      <Box>{props.children}</Box>
      <Box sx={{ overflowAnchor: 'auto', height: '1px' }} />
    </Box>
  );
}
