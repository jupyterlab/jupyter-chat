/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IChatModel } from '../model';
import { IChatMessage } from '../types';

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
