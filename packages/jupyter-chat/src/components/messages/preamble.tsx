/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React from 'react';

import { useChatContext } from '../../context';
import { IChatMessage } from '../../types';

/**
 * The preamble component properties.
 */
export interface IMessagePreambleProps {
  message: IChatMessage;
}

/**
 * Renders all registered preamble components vertically above the message body.
 */
export function MessagePreambleComponent(
  props: IMessagePreambleProps
): JSX.Element | null {
  const { message } = props;
  const { model, messagePreambleRegistry } = useChatContext();
  if (!messagePreambleRegistry) {
    return null;
  }
  const components = messagePreambleRegistry.getComponents();
  if (!components.length) {
    return null;
  }

  return (
    <>
      {components.map((Component, i) => (
        <Component key={i} model={model} message={message} />
      ))}
    </>
  );
}
