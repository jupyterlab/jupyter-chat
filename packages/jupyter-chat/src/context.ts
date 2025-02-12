/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { createContext } from 'react';
import { IAttachmentOpenerRegistry } from './registry';

export const AttachmentOpenerContext = createContext<
  IAttachmentOpenerRegistry | undefined
>(undefined);
