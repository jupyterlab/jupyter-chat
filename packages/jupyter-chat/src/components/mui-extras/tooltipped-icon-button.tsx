/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { classes } from '@jupyterlab/ui-components';
import { IconButton, IconButtonProps } from '@mui/material';
import React from 'react';

import { ContrastingTooltip } from './contrasting-tooltip';
import {
  TOOLTIPPED_WRAP_CLASS,
  TooltippedButtonProps
} from './tooltipped-button';

/**
 * The props for the tooltipped icon button.
 */
export type TooltippedIconButtonProps = TooltippedButtonProps & {
  /**
   * Props passed directly to the MUI `IconButton` component.
   */
  buttonProps?: IconButtonProps;
};

/**
 * A component that renders an MUI `IconButton` with a high-contrast tooltip
 * provided by `ContrastingTooltip`. This component differs from the MUI
 * defaults in the following ways:
 *
 * - Shows the tooltip on hover even if disabled.
 * - Renders the tooltip above the button by default.
 * - Renders the tooltip closer to the button by default.
 * - Lowers the opacity of the IconButton when disabled.
 * - Renders the IconButton with `line-height: 0` to avoid showing extra
 * vertical space in SVG icons.
 *
 * NOTES:
 *  This kind of button doesn't allow regular variants ('outlined', 'contained', 'text').
 *  The only one allowed is 'input-toolbar'. If you want to use one of the regular, use
 *  the TooltippedButton instead.
 */
export function TooltippedIconButton(
  props: TooltippedIconButtonProps
): JSX.Element {
  return (
    <ContrastingTooltip
      title={props.tooltip}
      placement={props.placement ?? 'top'}
      slotProps={{
        popper: {
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, -8]
              }
            }
          ]
        }
      }}
    >
      {/*
        By default, tooltips never appear when the IconButton is disabled. The
        official way to support this feature in MUI is to wrap the child Button
        element in a `span` element.

        See: https://mui.com/material-ui/react-tooltip/#disabled-elements
      */}
      <span className={classes(props.className, TOOLTIPPED_WRAP_CLASS)}>
        <IconButton
          {...((props.inputToolbar ?? true) && { variant: 'input-toolbar' })}
          {...props.buttonProps}
          onClick={props.onClick}
          disabled={props.disabled}
          aria-label={props['aria-label'] ?? props.tooltip}
          sx={{
            ...props.sx
          }}
        >
          {props.children}
        </IconButton>
      </span>
    </ContrastingTooltip>
  );
}
