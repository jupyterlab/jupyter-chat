/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Token } from '@lumino/coreutils';
import { IInputToolbarRegistry } from './index';

/**
 * A factory interface for creating a new Input Toolbar Registry
 * for each Chat Panel.
 */
export interface IInputToolbarRegistryFactory {
  /**
   * Create a new input toolbar registry instance.
   */
  create: () => IInputToolbarRegistry;
}

/**
 * The token of the factory to create an input toolbar registry.
 */
export const IInputToolbarRegistryFactory =
  new Token<IInputToolbarRegistryFactory>(
    '@jupyter/chat:IInputToolbarRegistryFactory'
  );
