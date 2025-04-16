/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Token } from '@lumino/coreutils';
import { Footers, IChatMessageFooter } from './types';

/**
 * The interface of a registry to provide chat footer.
 */
export interface IChatFooterRegistry {
  /**
   * Get the footer from the registry.
   */
  get(): Footers;
  /**
   * Add a message footer.
   * If several extension add footers, only the last one will be displayed.
   */
  add(footer: IChatMessageFooter): void;
}

/**
 * The default implementation of the chat footer registry.
 */
export class ChatFooterRegistry implements IChatFooterRegistry {
  /**
   * Get the footer from the registry.
   */
  get(): Footers {
    return this._footers;
  }

  /**
   * Add a message footer.
   * If several extension add footers, only the last one will be displayed.
   */
  add(footer: IChatMessageFooter): void {
    this._footers[footer.position] = footer;
  }

  private _footers: Footers = {};
}

/**
 * The token providing the chat footer registry.
 */
export const IChatFooterRegistry = new Token<IChatFooterRegistry>(
  '@jupyter/chat:ChatFooterRegistry'
);
