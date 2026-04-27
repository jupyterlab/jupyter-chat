/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IWidgetTracker, MainAreaWidget } from '@jupyterlab/apputils';
import { Token } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

import { ChatWidget, Placeholder } from './widgets';
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

/**
 * The interface for the placeholder factory.
 */
export interface IChatPlaceholderFactory {
  /**
   * Create a placeholder widget for the multi-chat panel.
   *
   * @param props - the props passed to the placeholder.
   * @returns a widget to display as placeholder.
   */
  create(props: Placeholder.IProps): Widget;
}

/**
 * The token for the placeholder factory.
 * Not provided by default — extensions can provide it to replace the default
 * placeholder shown when no chat is open in the multi-chat panel.
 */
export const IChatPlaceholderFactory = new Token<IChatPlaceholderFactory>(
  '@jupyter/chat:IChatPlaceholderFactory',
  'The placeholder factory for the multi-chat panel'
);
