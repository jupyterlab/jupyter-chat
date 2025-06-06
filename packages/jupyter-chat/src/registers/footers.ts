/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Token } from '@lumino/coreutils';
import { IChatModel } from '../model';
import { IChatMessage } from '../types';

/**
 * The token providing the chat footer registry.
 */
export const IMessageFooterRegistry = new Token<IMessageFooterRegistry>(
  '@jupyter/chat:ChatFooterRegistry'
);

/**
 * The interface of a registry to provide chat footer.
 */
export interface IMessageFooterRegistry {
  /**
   * Get the message footer.
   */
  getFooter(): MessageFooter;
  /**
   * Add a message footer section.
   * If multiple labextensions add a section in the same region, only
   * the last one will be displayed.
   */
  addSection(section: MessageFooterSection): void;
}

/**
 * The props sent passed to each `MessageFooterSection` React component.
 */
export type MessageFooterSectionProps = {
  model: IChatModel;
  message: IChatMessage;
};

/**
 * A message footer section which can be added to the footer registry.
 */
export type MessageFooterSection = {
  component: React.FC<MessageFooterSectionProps>;
  position: 'left' | 'center' | 'right';
};

/**
 * The message footer returned by the registry, composed of 'left', 'center',
 * and 'right' sections.
 */
export type MessageFooter = {
  left?: MessageFooterSection;
  center?: MessageFooterSection;
  right?: MessageFooterSection;
};

/**
 * The default implementation of the message footer registry.
 */
export class MessageFooterRegistry implements IMessageFooterRegistry {
  /**
   * Get the footer from the registry.
   */
  getFooter(): MessageFooter {
    return this._footers;
  }

  /**
   * Add a message footer.
   * If several extension add footers, only the last one will be displayed.
   */
  addSection(footer: MessageFooterSection): void {
    this._footers[footer.position] = footer;
  }

  private _footers: MessageFooter = {};
}
