/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useEffect, useState } from 'react';

import { useChatContext } from '../../context';
import { IMessage, IMessageContent } from '../../types';

/**
 * The preamble component properties.
 */
export interface IMessagePreambleProps {
  message: IMessage;
}

/**
 * Renders all registered preamble components vertically above the message body.
 */
export function MessagePreambleComponent(
  props: IMessagePreambleProps
): JSX.Element | null {
  const [message, setMessage] = useState<IMessageContent>(
    props.message.content
  );

  useEffect(() => {
    function messageChanged() {
      setMessage(props.message.content);
    }
    props.message.changed.connect(messageChanged);
    setMessage(props.message.content);
    return () => {
      props.message.changed.disconnect(messageChanged);
    };
  }, [props.message]);

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
