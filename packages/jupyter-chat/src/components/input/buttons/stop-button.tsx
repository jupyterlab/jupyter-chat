/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import StopIcon from '@mui/icons-material/Stop';
import React, { useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras';

const STOP_BUTTON_CLASS = 'jp-chat-stop-button';

/**
 * The stop button.
 */
export function StopButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
  const { chatModel } = props;
  const [disabled, setDisabled] = useState(true);
  const tooltip = 'Stop generating';

  useEffect(() => {
    if (!chatModel) {
      setDisabled(true);
      return;
    }

    const checkWriters = () => {
      // Check if there's at least one AI agent writer (bot)
      const hasAIWriter = chatModel.writers.some(writer => writer.user.bot);
      setDisabled(!hasAIWriter);
    };

    // Check initially
    checkWriters();

    // Listen to writers changes
    chatModel.writersChanged?.connect(checkWriters);

    return () => {
      chatModel.writersChanged?.disconnect(checkWriters);
    };
  }, [chatModel]);

  function stop() {
    // TODO: Implement stop functionality
    // This will need to be implemented based on how the chat model handles stopping AI responses
    console.log('Stop button clicked');
  }

  return (
    <TooltippedIconButton
      onClick={stop}
      tooltip={tooltip}
      disabled={disabled}
      buttonProps={{
        title: tooltip,
        className: STOP_BUTTON_CLASS
      }}
      aria-label={tooltip}
    >
      <StopIcon />
    </TooltippedIconButton>
  );
}
