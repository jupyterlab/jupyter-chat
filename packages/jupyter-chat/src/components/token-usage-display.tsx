/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ITokenUsage } from '../types';
import { Box, Typography } from '@mui/material';
import React from 'react';

export interface ITokenUsageDisplayProps {
  usage?: ITokenUsage;
}

/**
 * Component to display cumulative token usage and estimated cost.
 */
export function TokenUsageDisplay(props: ITokenUsageDisplayProps): JSX.Element | null {
  const { usage } = props;

  if (!usage || (!usage.total_tokens && !usage.input_tokens && !usage.output_tokens)) {
    return null;
  }

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) {
      return '0';
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatCost = (cost: number | undefined): string => {
    if (cost === undefined || cost === 0) {
      return '$0.00';
    }
    if (cost < 0.01) {
      return '<$0.01';
    }
    return `$${cost.toFixed(2)}`;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '4px 8px',
        fontSize: '0.75rem',
        color: 'var(--jp-ui-font-color2)',
        borderRadius: '4px',
        backgroundColor: 'var(--jp-layout-color2)'
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontFamily: 'var(--jp-code-font-family)',
          fontSize: '0.75rem'
        }}
        title={`Input: ${usage.input_tokens || 0} | Output: ${usage.output_tokens || 0} | Total: ${usage.total_tokens || 0}`}
      >
        {formatNumber(usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0))} tokens
      </Typography>
      {usage.cost !== undefined && usage.cost > 0 && (
        <>
          <Typography
            variant="caption"
            sx={{
              color: 'var(--jp-ui-font-color3)'
            }}
          >
            •
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'var(--jp-code-font-family)',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
            title="Estimated cost based on model pricing"
          >
            {formatCost(usage.cost)}
          </Typography>
        </>
      )}
    </Box>
  );
}
