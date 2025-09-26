/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { createContext, useContext } from 'react';

import { Chat } from './components';

export const ChatReactContext = createContext<Chat.IChatProps | undefined>(
  undefined
);

export function useChatContext(): Chat.IChatProps {
  const context = useContext(ChatReactContext);
  if (!context) {
    throw new Error('The chat context is missing in the chat');
  }
  return context;
}
