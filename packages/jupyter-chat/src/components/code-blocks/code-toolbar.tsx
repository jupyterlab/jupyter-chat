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

  const [toolbarBtnProps, setToolbarBtnProps] = useState<ToolbarButtonProps>({
    content: content,
    activeCellManager: activeCellManager,
    activeCellAvailable: activeCellManager?.available ?? false
  });

  useEffect(() => {
    activeCellManager?.availabilityChanged.connect(() => {
      setToolbarBtnProps({
        content,
        activeCellManager: activeCellManager,
        activeCellAvailable: activeCellManager.available
      });
    });

    model.configChanged.connect((_, config) => {
      setToolbarEnable(config.enableCodeToolbar ?? true);
    });
  }, [model]);

  return activeCellManager === null || !toolbarEnable ? (
    <></>
  ) : (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '6px 2px',
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
  activeCellAvailable?: boolean;
  activeCellManager: IActiveCellManager | null;
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
  const tooltip = props.activeCellAvailable
    ? 'Replace active cell'
    : 'Replace active cell (no active cell)';

  return (
    <TooltippedIconButton
      className={props.className}
      tooltip={tooltip}
      disabled={!props.activeCellAvailable}
      onClick={() => props.activeCellManager?.replace(props.content)}
    >
      <replaceCellIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}
