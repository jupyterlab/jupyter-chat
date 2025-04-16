/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatModel } from '../model';
import { IChatMessage } from '../types';

/**
 * The properties sent to any footer component.
 */
export interface IChatMessageFooterProps {
  model: IChatModel;
  message: IChatMessage;
}

/**
 * The chat footer added to the registry.
 */
export interface IChatMessageFooter {
  component: React.FC<IChatMessageFooterProps>;
  position: 'left' | 'center' | 'right';
}

/**
 * The footers returned by the registry.
 */
export type Footers = {
  left?: IChatMessageFooter;
  center?: IChatMessageFooter;
  right?: IChatMessageFooter;
};
