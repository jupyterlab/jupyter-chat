/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { TranslationBundle } from '@jupyterlab/translation';
import { Box, SxProps, Theme, Typography } from '@mui/material';
import React from 'react';

import { useTranslator } from '../context';
import { IChatModel } from '../model';

/**
 * Classname on the root element. Used in E2E tests.
 */
const WRITERS_ELEMENT_CLASSNAME = 'jp-chat-writers';

/**
 * The input writing indicator component props.
 */
export interface IInputWritingIndicatorProps {
  /**
   * The list of users currently writing.
   */
  writers: IChatModel.IWriter[];
  /**
   * Custom mui/material styles.
   */
  sx?: SxProps<Theme>;
}

/**
 * Format the writers list into a readable string.
 * Examples: "Alice is typing...", "Alice and Bob are typing...", "Alice, Bob, and Carol are typing..."
 */
function formatWritersText(
  writers: IChatModel.IWriter[],
  trans: TranslationBundle
): string {
  if (writers.length === 0) {
    return '';
  }

  const nameOf = (w: IChatModel.IWriter) =>
    w.user.display_name ??
    w.user.name ??
    w.user.username ??
    trans.__('Unknown');

  // When any writer supplies a custom typing indicator, render per-writer
  // phrases ("<name> <indicator>"), so e.g. "Jupyternaut is running `ripgrep`".
  if (writers.some(w => w.typingIndicator)) {
    const phrases = writers.map(
      w => `${nameOf(w)} ${w.typingIndicator ?? trans.__('is typing...')}`
    );
    if (phrases.length === 1) {
      return phrases[0];
    } else if (phrases.length === 2) {
      return trans.__('%1 and %2', phrases[0], phrases[1]);
    } else {
      const allButLast = phrases.slice(0, -1).join(', ');
      return trans.__('%1, and %2', allButLast, phrases[phrases.length - 1]);
    }
  }

  const names = writers.map(nameOf);

  if (names.length === 1) {
    return trans.__('%1 is typing...', names[0]);
  } else if (names.length === 2) {
    return trans.__('%1 and %2 are typing...', names[0], names[1]);
  } else {
    const allButLast = names.slice(0, -1).join(', ');
    const last = names[names.length - 1];
    return trans.__('%1, and %2 are typing...', allButLast, last);
  }
}

/**
 * The writing indicator component, displaying typing status.
 */
export function WritingIndicator(
  props: IInputWritingIndicatorProps
): JSX.Element {
  const { writers } = props;
  const trans = useTranslator();

  // Always render the container to reserve space, even if no writers
  const writersText =
    writers.length > 0 ? formatWritersText(writers, trans) : '';

  return (
    <Box
      className={WRITERS_ELEMENT_CLASSNAME}
      // The indicator already says something useful, "Alice is typing..." or
      // "Jupyternaut is running `ripgrep`", but only on screen. Announcing it
      // politely means a screen reader user learns a reply is coming without
      // being interrupted mid-sentence.
      //
      // The region is the container rather than the text, so it is present in
      // the accessibility tree before a writer appears and the change is
      // announced. `aria-atomic` keeps the phrase together: without it a name
      // change alone can be read out on its own, stripped of its context.
      role="status"
      aria-live="polite"
      aria-atomic="true"
      sx={{
        ...props.sx,
        minHeight: '16px'
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'var(--jp-ui-font-color2)',
          display: 'block',
          fontSize: '10px',
          fontFamily: 'var(--jp-ui-font-family)',
          lineHeight: '16px',
          visibility: writers.length > 0 ? 'visible' : 'hidden'
        }}
      >
        {writersText || '\u00A0'}
      </Typography>
    </Box>
  );
}
