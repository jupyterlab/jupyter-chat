/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { Token } from '@lumino/coreutils';
import { IAttachment } from './types';

/**
 * The token for the attachments opener registry, which can be provided by an extension
 * using @jupyter/chat package.
 */
export const IAttachmentOpenerRegistry = new Token<IAttachmentOpenerRegistry>(
  '@jupyter/chat:IAttachmentOpenerRegistry'
);

/**
 * The interface of a registry to provide attachments opener.
 */
export interface IAttachmentOpenerRegistry {
  /**
   * Get the function opening an attachment for a given type.
   */
  get(type: string): ((attachment: IAttachment) => void) | undefined;
  /**
   * Register a function to open an attachment type.
   */
  set(type: string, opener: (attachment: IAttachment) => void): void;
}

/**
 * The default registry, a Map object.
 */
export class AttachmentOpenerRegistry
  extends Map<string, (attachment: IAttachment) => void>
  implements IAttachmentOpenerRegistry {}
