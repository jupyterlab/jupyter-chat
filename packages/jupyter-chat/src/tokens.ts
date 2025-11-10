/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IWidgetTracker } from '@jupyterlab/apputils';
import { Token } from '@lumino/coreutils';

import { ChatWidget } from './widgets';

/**
 * the chat tracker type.
 */
export type IChatTracker = IWidgetTracker<ChatWidget>;

/**
 * A chat tracker token.
 */
export const IChatTracker = new Token<IChatTracker>(
  '@jupyter/chat:IChatTracker',
  'The chat widget tracker'
);
