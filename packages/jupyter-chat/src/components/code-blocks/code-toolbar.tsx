/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { addAboveIcon, addBelowIcon } from '@jupyterlab/ui-components';
import { Box } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { CopyButton } from './copy-button';
import { TooltippedIconButton } from '../mui-extras/tooltipped-icon-button';
import { IActiveCellManager } from '../../active-cell-manager';
import { replaceCellIcon } from '../../icons';
import { IChatModel } from '../../model';
import { ISelectionWatcher } from '../../selection-watcher';

const CODE_TOOLBAR_CLASS = 'jp-chat-code-toolbar';
const CODE_TOOLBAR_ITEM_CLASS = 'jp-chat-code-toolbar-item';

export type CodeToolbarProps = {
  /**
   * The chat model.
   */
  model: IChatModel;
  /**
   * The content of the Markdown code block this component is attached to.
   */
  content: string;
};

export function CodeToolbar(props: CodeToolbarProps): JSX.Element {
  const { content, model } = props;
  const [toolbarEnable, setToolbarEnable] = useState<boolean>(
    model.config.enableCodeToolbar ?? true
  );

  const activeCellManager = model.activeCellManager;
  const selectionWatcher = model.selectionWatcher;

  const [toolbarBtnProps, setToolbarBtnProps] = useState<ToolbarButtonProps>({
    content,
    activeCellManager,
    selectionWatcher,
    activeCellAvailable: !!activeCellManager?.available,
    selectionExists: !!selectionWatcher?.selection
  });

  useEffect(() => {
    const toggleToolbar = () => {
      setToolbarEnable(model.config.enableCodeToolbar ?? true);
    };

    const selectionStatusChange = () => {
      setToolbarBtnProps({
        content,
        activeCellManager,
        selectionWatcher,
        activeCellAvailable: !!activeCellManager?.available,
        selectionExists: !!selectionWatcher?.selection
      });
    };

    activeCellManager?.availabilityChanged.connect(selectionStatusChange);
    selectionWatcher?.selectionChanged.connect(selectionStatusChange);
    model.configChanged.connect(toggleToolbar);

    selectionStatusChange();
    return () => {
      activeCellManager?.availabilityChanged.disconnect(selectionStatusChange);
      selectionWatcher?.selectionChanged.disconnect(selectionStatusChange);
      model.configChanged.disconnect(toggleToolbar);
    };
  }, [model]);

  return activeCellManager === null || !toolbarEnable ? (
    <></>
  ) : (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '2px 2px',
        marginBottom: '1em',
        border: '1px solid var(--jp-cell-editor-border-color)',
        borderTop: 'none'
      }}
      className={CODE_TOOLBAR_CLASS}
    >
      <InsertAboveButton
        {...toolbarBtnProps}
        className={CODE_TOOLBAR_ITEM_CLASS}
      />
      <InsertBelowButton
        {...toolbarBtnProps}
        className={CODE_TOOLBAR_ITEM_CLASS}
      />
      <ReplaceButton {...toolbarBtnProps} className={CODE_TOOLBAR_ITEM_CLASS} />
      <CopyButton value={content} className={CODE_TOOLBAR_ITEM_CLASS} />
    </Box>
  );
}

type ToolbarButtonProps = {
  content: string;
  activeCellManager: IActiveCellManager | null;
  activeCellAvailable?: boolean;
  selectionWatcher: ISelectionWatcher | null;
  selectionExists?: boolean;
  className?: string;
};

function InsertAboveButton(props: ToolbarButtonProps) {
  const tooltip = props.activeCellAvailable
    ? 'Insert above active cell'
    : 'Insert above active cell (no active cell)';

  return (
    <TooltippedIconButton
      className={props.className}
      tooltip={tooltip}
      onClick={() => props.activeCellManager?.insertAbove(props.content)}
      disabled={!props.activeCellAvailable}
    >
      <addAboveIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}

function InsertBelowButton(props: ToolbarButtonProps) {
  const tooltip = props.activeCellAvailable
    ? 'Insert below active cell'
    : 'Insert below active cell (no active cell)';

  return (
    <TooltippedIconButton
      className={props.className}
      tooltip={tooltip}
      disabled={!props.activeCellAvailable}
      onClick={() => props.activeCellManager?.insertBelow(props.content)}
    >
      <addBelowIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}

function ReplaceButton(props: ToolbarButtonProps) {
  const tooltip = props.selectionExists
    ? `Replace selection (${props.selectionWatcher?.selection?.numLines} line(s))`
    : props.activeCellAvailable
      ? 'Replace selection (active cell)'
      : 'Replace selection (no selection)';

  const disabled = !props.activeCellAvailable && !props.selectionExists;

  const replace = () => {
    if (props.selectionExists) {
      const selection = props.selectionWatcher?.selection;
      if (!selection) {
        return;
      }
      props.selectionWatcher?.replaceSelection({
        ...selection,
        text: props.content
      });
    } else if (props.activeCellAvailable) {
      props.activeCellManager?.replace(props.content);
    }
  };

  return (
    <TooltippedIconButton
      className={props.className}
      tooltip={tooltip}
      disabled={disabled}
      onClick={replace}
    >
      <replaceCellIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}
