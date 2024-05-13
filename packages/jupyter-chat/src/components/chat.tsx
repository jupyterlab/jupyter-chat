/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton } from '@mui/material';
import { Box } from '@mui/system';
import React, { useState, useEffect } from 'react';

import { JlThemeProvider } from './jl-theme-provider';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ScrollContainer } from './scroll-container';
import { IChatModel } from '../model';
import { IChatMessage, IMessage } from '../types';

type ChatBodyProps = {
  model: IChatModel;
  rmRegistry: IRenderMimeRegistry;
};

function ChatBody({
  model,
  rmRegistry: renderMimeRegistry
}: ChatBodyProps): JSX.Element {
  const [messages, setMessages] = useState<IChatMessage[]>([]);

  /**
   * Effect: fetch history and config on initial render
   */
  useEffect(() => {
    async function fetchHistory() {
      if (!model.getHistory) {
        return;
      }
      model
        .getHistory()
        .then(history => setMessages(history.messages))
        .catch(e => console.error(e));
    }

    fetchHistory();
  }, [model]);

  /**
   * Effect: listen to chat messages
   */
  useEffect(() => {
    function handleChatEvents(_: IChatModel, message: IMessage) {
      if (message.type === 'clear') {
        setMessages([]);
        return;
      } else {
        setMessages((messageGroups: IChatMessage[]) => {
          const existingMessages = [...messageGroups];

          const messageIndex = existingMessages.findIndex(
            msg => msg.id === message.id
          );
          if (messageIndex > -1) {
            // The message is an update of an existing one (or a removal).
            // Let's remove it anyway (to avoid position conflict if timestamp has
            // changed) and add the new one if it is an update.
            existingMessages.splice(messageIndex, 1);
          }

          if (message.type === 'remove') {
            return existingMessages;
          }

          // Find the first message that should be after this one.
          let nextMsgIndex = existingMessages.findIndex(
            msg => msg.time > message.time
          );
          if (nextMsgIndex === -1) {
            // There is no message after this one, so let's insert the message at
            // the end.
            nextMsgIndex = existingMessages.length;
          }

          // Insert the message.
          existingMessages.splice(nextMsgIndex, 0, message);

          return existingMessages;
        });
      }
    }

    model.incomingMessage.connect(handleChatEvents);
    return function cleanup() {
      model.incomingMessage.disconnect(handleChatEvents);
    };
  }, [model]);

  // no need to append to messageGroups imperatively here. all of that is
  // handled by the listeners registered in the effect hooks above.
  const onSend = async (input: string) => {
    // send message to backend
    model.addMessage({ body: input });
  };

  return (
    <>
      <ScrollContainer sx={{ flexGrow: 1 }}>
        <ChatMessages
          messages={messages}
          rmRegistry={renderMimeRegistry}
          model={model}
        />
      </ScrollContainer>
      <ChatInput
        onSend={onSend}
        sx={{
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 3.5,
          paddingBottom: 0,
          borderTop: '1px solid var(--jp-border-color1)'
        }}
        sendWithShiftEnter={model.config.sendWithShiftEnter ?? false}
      />
    </>
  );
}

export function Chat(props: Chat.IOptions): JSX.Element {
  const [view, setView] = useState<Chat.ChatView>(
    props.chatView || Chat.ChatView.Chat
  );
  return (
    <JlThemeProvider themeManager={props.themeManager ?? null}>
      <Box
        // root box should not include padding as it offsets the vertical
        // scrollbar to the left
        sx={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--jp-layout-color0)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* top bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {view !== Chat.ChatView.Chat ? (
            <IconButton onClick={() => setView(Chat.ChatView.Chat)}>
              <ArrowBackIcon />
            </IconButton>
          ) : (
            <Box />
          )}
          {view === Chat.ChatView.Chat && props.settingsPanel ? (
            <IconButton onClick={() => setView(Chat.ChatView.Settings)}>
              <SettingsIcon />
            </IconButton>
          ) : (
            <Box />
          )}
        </Box>
        {/* body */}
        {view === Chat.ChatView.Chat && (
          <ChatBody model={props.model} rmRegistry={props.rmRegistry} />
        )}
        {view === Chat.ChatView.Settings && props.settingsPanel && (
          <props.settingsPanel />
        )}
      </Box>
    </JlThemeProvider>
  );
}

/**
 * The chat UI namespace
 */
export namespace Chat {
  /**
   * The options to build the Chat UI.
   */
  export interface IOptions {
    /**
     * The chat model.
     */
    model: IChatModel;
    /**
     * The rendermime registry.
     */
    rmRegistry: IRenderMimeRegistry;
    /**
     * The theme manager.
     */
    themeManager?: IThemeManager | null;
    /**
     * The view to render.
     */
    chatView?: ChatView;
    /**
     * A settings panel that can be used for dedicated settings (e.g. jupyter-ai)
     */
    settingsPanel?: () => JSX.Element;
  }

  /**
   * The view to render.
   * The settings view is available only if the settings panel is provided in options.
   */
  export enum ChatView {
    Chat,
    Settings
  }
}
