/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { useChatContext } from '../../context';

/**
 * Component that renders chat body placeholder using the factory from context.
 * Renders nothing if no factory is provided.
 */
export function ChatBodyPlaceholder(): JSX.Element | null {
  const { model, chatBodyPlaceholderFactory } = useChatContext();

  if (!chatBodyPlaceholderFactory) {
    return null;
  }

  const onSend = (body: string) => {
    model.sendMessage({ body });
  };

  return chatBodyPlaceholderFactory.create({ onSend });
}
