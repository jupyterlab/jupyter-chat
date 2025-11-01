/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import StopIcon from '@mui/icons-material/Stop';
import { Button, Tooltip } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';

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
    <Tooltip title={tooltip} placement="top" arrow>
      <span>
        <Button
          onClick={stop}
          disabled={disabled}
          size="small"
          variant="contained"
          className={STOP_BUTTON_CLASS}
          aria-label={tooltip}
          sx={{
            backgroundColor: 'var(--jp-error-color1)',
            color: 'white',
            minWidth: '24px',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            boxShadow: 'none',
            lineHeight: 0,
            '&:hover': {
              backgroundColor: 'var(--jp-error-color0)',
              boxShadow: 'none'
            },
            '&.Mui-disabled': {
              backgroundColor: 'var(--jp-border-color2)',
              color: 'var(--jp-ui-font-color3)',
              opacity: 0.5
            }
          }}
        >
          <StopIcon sx={{ fontSize: '16px' }} />
        </Button>
      </span>
    </Tooltip>
  );
}
