/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Token } from '@lumino/coreutils';
import { IChatModel } from '../model';
import { IMessageContent } from '../types';

/**
 * The token providing the chat preamble registry.
 */
export const IMessagePreambleRegistry = new Token<IMessagePreambleRegistry>(
  '@jupyter/chat:ChatPreambleRegistry'
);

/**
 * The props passed to each preamble component.
 */
export type MessagePreambleProps = {
  model: IChatModel;
  message: IMessageContent;
};

/**
 * The interface of a registry to provide message preamble components.
 * Preamble components render above the message body, after the header.
 */
export interface IMessagePreambleRegistry {
  /**
   * Add a preamble component to the registry.
   * Components are rendered in the order they are added.
   */
  addComponent(component: (props: MessagePreambleProps) => JSX.Element | null): void;
  /**
   * Get all registered preamble components.
   */
  getComponents(): ((props: MessagePreambleProps) => JSX.Element | null)[];
}

/**
 * The default implementation of the message preamble registry.
 */
export class MessagePreambleRegistry implements IMessagePreambleRegistry {
  /**
   * Add a preamble component to the registry.
   */
  addComponent(component: (props: MessagePreambleProps) => JSX.Element | null): void {
    this._components.push(component);
  }

  /**
   * Get all registered preamble components.
   */
  getComponents(): ((props: MessagePreambleProps) => JSX.Element | null)[] {
    return [...this._components];
  }

  private _components: ((props: MessagePreambleProps) => JSX.Element | null)[] = [];
}
