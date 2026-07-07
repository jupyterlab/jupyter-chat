/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IWidgetTracker } from '@jupyterlab/apputils';
import { Token } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

import { ChatWidget, Placeholder } from './widgets';
import { IChatModel } from './model';
import { ChatArea } from './types';

/**
 * The interface for any widget displaying a chat (main area or side panel).
 */
export interface IChatPanel extends Widget {
  /**
   * The chat widget embedded in the panel.
   */
  widget: ChatWidget;
  /**
   * The model of the chat widget.
   */
  model: IChatModel;
  /**
   * The area of the panel.
   */
  area: ChatArea;
  /**
   * The chat panel toolbar.
   */
  toolbar: Widget;
}

/**
 * the chat tracker type.
 */
export type IChatTracker = IWidgetTracker<IChatPanel>;

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

/**
 * The interface for the chat body placeholder factory.
 */
export interface IChatBodyPlaceholderFactory {
  /**
   * Create a chat body placeholder component shown when the chat has no messages.
   *
   * @param props - the props passed to the component.
   * @returns a React element to display as chat body placeholder.
   */
  create(props: IChatBodyPlaceholderFactory.IProps): JSX.Element | null;
}

export namespace IChatBodyPlaceholderFactory {
  /**
   * The props passed to the chat body placeholder factory.
   */
  export interface IProps {
    /**
     * Callback to send a message.
     */
    onSend: (body: string) => void;
  }
}

/**
 * The token for the chat body placeholder factory.
 * Not provided by default — extensions can provide it to display clickable
 * chat body placeholder when a chat has no messages.
 */
export const IChatBodyPlaceholderFactory =
  new Token<IChatBodyPlaceholderFactory>(
    '@jupyter/chat:IChatBodyPlaceholderFactory',
    'The chat body placeholder factory for empty chats'
  );
