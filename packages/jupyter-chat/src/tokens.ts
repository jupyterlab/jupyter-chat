/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IWidgetTracker, MainAreaWidget } from '@jupyterlab/apputils';
import { Token } from '@lumino/coreutils';

import { ChatWidget } from './widgets';
import { IChatModel } from './model';

/**
 * The main area chat widget type.
 */
export type MainAreaChat = MainAreaWidget<ChatWidget> & {
  model: IChatModel;
};

/**
 * the chat tracker type.
 */
export type IChatTracker = IWidgetTracker<ChatWidget | MainAreaChat>;

/**
 * A chat tracker token.
 */
export const IChatTracker = new Token<IChatTracker>(
  '@jupyter/chat:IChatTracker',
  'The chat widget tracker'
);
