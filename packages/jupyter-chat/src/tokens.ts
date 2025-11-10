/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { WidgetTracker } from '@jupyterlab/apputils';
import { Token } from '@lumino/coreutils';

import { ChatWidget } from './widgets';

/**
 * A chat tracker token.
 */
export const IChatTracker = new Token<WidgetTracker<ChatWidget>>(
  '@jupyter/chat:IChatTracker',
  'The chat widget tracker'
);
