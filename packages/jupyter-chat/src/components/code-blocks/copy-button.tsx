/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useState, useCallback, useRef } from 'react';

import { copyIcon } from '@jupyterlab/ui-components';

import { TooltippedIconButton } from '../mui-extras/tooltipped-icon-button';

enum CopyStatus {
  None,
  Copying,
  Copied,
  Disabled
}

const COPYBTN_TEXT_BY_STATUS: Record<CopyStatus, string> = {
  [CopyStatus.None]: 'Copy to clipboard',
  [CopyStatus.Copying]: 'Copying…',
  [CopyStatus.Copied]: 'Copied!',
  [CopyStatus.Disabled]: 'Copy to clipboard disabled in insecure context'
};

type CopyButtonProps = {
  value: string;
  className?: string;
};

export function CopyButton(props: CopyButtonProps): JSX.Element {
  const isCopyDisabled = navigator.clipboard === undefined;
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(
    isCopyDisabled ? CopyStatus.Disabled : CopyStatus.None
  );
  const timeoutId = useRef<number | null>(null);

  const copy = useCallback(async () => {
    // ignore if we are already copying
    if (copyStatus === CopyStatus.Copying) {
      return;
    }

    try {
      await navigator.clipboard.writeText(props.value);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyStatus(CopyStatus.None);
      return;
    }

    setCopyStatus(CopyStatus.Copied);
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    timeoutId.current = window.setTimeout(
      () => setCopyStatus(CopyStatus.None),
      1000
    );
  }, [copyStatus, props.value]);

  return (
    <TooltippedIconButton
      disabled={isCopyDisabled}
      className={props.className}
      tooltip={COPYBTN_TEXT_BY_STATUS[copyStatus]}
      placement="top"
      onClick={copy}
      aria-label="Copy to clipboard"
    >
      <copyIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}
