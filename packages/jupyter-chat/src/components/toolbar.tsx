import {
  ToolbarButtonComponent,
  deleteIcon,
  editIcon
} from '@jupyterlab/ui-components';
import React from 'react';

const TOOLBAR_CLASS = 'jp-chat-toolbar';

/**
 * The toolbar attached to a message.
 */
export function MessageToolbar(props: MessageToolbar.IProps): JSX.Element {
  const buttons: JSX.Element[] = [];

  if (props.edit !== undefined) {
    const editButton = ToolbarButtonComponent({
      icon: editIcon,
      onClick: props.edit
    });
    buttons.push(editButton);
  }
  if (props.delete !== undefined) {
    const deleteButton = ToolbarButtonComponent({
      icon: deleteIcon,
      onClick: props.delete
    });
    buttons.push(deleteButton);
  }

  return (
    <div className={TOOLBAR_CLASS}>
      {buttons.map(toolbarButton => toolbarButton)}
    </div>
  );
}

export namespace MessageToolbar {
  export interface IProps {
    edit?: () => void;
    delete?: () => void;
  }
}
