/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { useChatContext } from '../../context';

/**
 * Component that renders message suggestions using the factory from context.
 * Renders nothing if no factory is provided.
 */
export function MessageSuggestions(): JSX.Element | null {
  const { model, messageSuggestionsFactory } = useChatContext();

  if (!messageSuggestionsFactory) {
    return null;
  }

  const onSend = (body: string) => {
    model.sendMessage({ body });
  };

  return messageSuggestionsFactory.create({ onSend });
}
