/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';
import { createContext, useContext } from 'react';

import { Chat } from './components';

const TRANSLATION_DOMAIN = 'jupyterlab_chat';

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

/**
 * Hook to get the translation bundle for the chat.
 * Must be used within a ChatReactContext.Provider.
 */
export function useTranslator(): TranslationBundle {
  const context = useContext(ChatReactContext);
  const translator = context?.translator ?? nullTranslator;
  return translator.load(TRANSLATION_DOMAIN);
}
