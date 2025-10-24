/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { checkIcon } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { InputToolbarRegistry } from '../toolbar-registry';
import { TooltippedIconButton } from '../../mui-extras/tooltipped-icon-button';

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
    <TooltippedIconButton
      className={SAVE_EDIT_BUTTON_CLASS}
      tooltip={tooltip}
      onClick={save}
      disabled={disabled}
      iconButtonProps={{
        sx: {
          marginLeft: 0,
          minWidth: '24px',
          width: '24px',
          height: '24px',
          padding: 0
        }
      }}
    >
      <checkIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}
