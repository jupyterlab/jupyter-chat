/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import CheckIcon from '@mui/icons-material/Check';
import { IconButton, Tooltip } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';

const SAVE_EDIT_BUTTON_CLASS = 'jp-chat-save-edit-button';

/**
 * The save edit button.
 */
export function SaveEditButton(
  props: InputToolbarRegistry.IToolbarItemProps
): JSX.Element {
  const { model, chatCommandRegistry, edit } = props;

  // Don't show this button when not in edit mode
  if (!edit) {
    return <></>;
  }

  const [disabled, setDisabled] = useState(false);
  const tooltip = 'Save edits';

  useEffect(() => {
    const inputChanged = () => {
      const inputExist = !!model.value.trim() || model.attachments.length;
      setDisabled(!inputExist);
    };

    model.valueChanged.connect(inputChanged);
    model.attachmentsChanged?.connect(inputChanged);

    inputChanged();

    return () => {
      model.valueChanged.disconnect(inputChanged);
      model.attachmentsChanged?.disconnect(inputChanged);
    };
  }, [model]);

  async function save() {
    await chatCommandRegistry?.onSubmit(model);
    model.send(model.value);
  }

  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <span>
        <IconButton
          onClick={save}
          disabled={disabled}
          className={SAVE_EDIT_BUTTON_CLASS}
          aria-label={tooltip}
          sx={{
            width: '24px',
            height: '24px',
            padding: 0,
            lineHeight: 0,
            '&.Mui-disabled': {
              opacity: 0.5
            }
          }}
        >
          <CheckIcon sx={{ fontSize: '16px' }} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
