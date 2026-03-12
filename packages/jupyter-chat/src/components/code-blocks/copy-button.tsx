/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { copyIcon } from '@jupyterlab/ui-components';
import React, { useState, useCallback, useRef } from 'react';

import { TooltippedIconButton } from '../mui-extras';
import { useTranslator } from '../../context';

enum CopyStatus {
  None,
  Copying,
  Copied,
  Disabled
}

type CopyButtonProps = {
  value: string;
  className?: string;
};

export function CopyButton(props: CopyButtonProps): JSX.Element {
  const trans = useTranslator();
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

  const COPYBTN_TEXT_BY_STATUS: Record<CopyStatus, string> = {
    [CopyStatus.None]: trans.__('Copy to clipboard'),
    [CopyStatus.Copying]: trans.__('Copying…'),
    [CopyStatus.Copied]: trans.__('Copied!'),
    [CopyStatus.Disabled]: trans.__(
      'Copy to clipboard disabled in insecure context'
    )
  };

  const tooltip = COPYBTN_TEXT_BY_STATUS[copyStatus];

  return (
    <TooltippedIconButton
      disabled={isCopyDisabled}
      className={props.className}
      tooltip={tooltip}
      placement="top"
      onClick={copy}
      aria-label={trans.__('Copy to clipboard')}
      inputToolbar={false}
    >
      <copyIcon.react height="16px" width="16px" />
    </TooltippedIconButton>
  );
}
