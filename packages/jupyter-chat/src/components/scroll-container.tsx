/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { forwardRef, useMemo } from 'react';
import { Box, SxProps, Theme } from '@mui/material';

type ScrollContainerProps = {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
};

/**
 * Scrollable container for chat messages. Scroll position is managed
 * explicitly by the parent (ChatMessages) via a forwarded ref.
 *
 * `overflowAnchor: 'none'` disables the browser's built-in scroll anchoring
 * which caused partial viewport shifts on new content in Chrome/Firefox
 * and is unsupported in Safari.
 */
export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  function ScrollContainer(props, ref) {
    const id = useMemo(
      () => 'jupyter-chat-scroll-container-' + Date.now().toString(),
      []
    );

    return (
      <Box
        ref={ref}
        id={id}
        sx={{
          overflowY: 'scroll',
          overflowAnchor: 'none',
          ...props.sx
        }}
      >
        {props.children}
      </Box>
    );
  }
);
