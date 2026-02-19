/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import React, { useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras';
import { IInputModel, InputModel } from '../../../input-model';

const SEND_BUTTON_CLASS = 'jp-chat-send-button';

/**
 * The send button.
 */
export function SendButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
  const { model, chatCommandRegistry, edit } = props;

  // Don't show this button when in edit mode
  if (edit) {
    return <></>;
  }

  const [disabled, setDisabled] = useState(false);
  const [tooltip, setTooltip] = useState<string>('');

  useEffect(() => {
    const inputChanged = () => {
      const inputExist = !!model.value.trim() || model.attachments.length;
      setDisabled(!inputExist);
    };

    model.valueChanged.connect(inputChanged);
    model.attachmentsChanged?.connect(inputChanged);

    inputChanged();

    const configChanged = (_: IInputModel, config: InputModel.IConfig) => {
      setTooltip(
        (config.sendWithShiftEnter ?? false)
          ? 'Send message (SHIFT+ENTER)'
          : 'Send message (ENTER)'
      );
    };
    model.configChanged.connect(configChanged);

    // Initialize the tooltip.
    configChanged(model, model.config);

    return () => {
      model.valueChanged.disconnect(inputChanged);
      model.attachmentsChanged?.disconnect(inputChanged);
      model.configChanged?.disconnect(configChanged);
    };
  }, [model]);

  async function send() {
    // Run all command providers
    await chatCommandRegistry?.onSubmit(model);

    const body = model.value;

    model.value = '';
    model.send(body);
  }

  return (
    <TooltippedIconButton
      onClick={send}
      tooltip={tooltip}
      disabled={disabled}
      buttonProps={{
        title: tooltip,
        className: SEND_BUTTON_CLASS
      }}
      aria-label={tooltip}
    >
      <ArrowUpwardIcon />
    </TooltippedIconButton>
  );
}
