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
import { IThemeManager } from '@jupyterlab/apputils';

type ChatBodyProps = {
  chatModel: IChatModel;
  rmRegistry: IRenderMimeRegistry;
};

function ChatBody({
  chatModel,
  rmRegistry: renderMimeRegistry
}: ChatBodyProps): JSX.Element {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [input, setInput] = useState('');

  /**
   * Effect: fetch history and config on initial render
   */
  useEffect(() => {
    async function fetchHistory() {
      if (!chatModel.getHistory) {
        return;
      }
      chatModel
        .getHistory()
        .then(history => setMessages(history.messages))
        .catch(e => console.error(e));
    }

    fetchHistory();
  }, [chatModel]);

  /**
   * Effect: listen to chat messages
   */
  useEffect(() => {
    function handleChatEvents(_: IChatModel, message: IMessage) {
      if (message.type === 'clear') {
        setMessages([]);
        return;
      } else if (message.type === 'msg') {
        setMessages(messageGroups => [...messageGroups, message]);
      }
    }

    chatModel.incomingMessage.connect(handleChatEvents);
    return function cleanup() {
      chatModel.incomingMessage.disconnect(handleChatEvents);
    };
  }, [chatModel]);

  // no need to append to messageGroups imperatively here. all of that is
  // handled by the listeners registered in the effect hooks above.
  const onSend = async () => {
    setInput('');

    // send message to backend
    chatModel.addMessage({ body: input });
  };

  return (
    <>
      <ScrollContainer sx={{ flexGrow: 1 }}>
        <ChatMessages messages={messages} rmRegistry={renderMimeRegistry} />
      </ScrollContainer>
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={onSend}
        sx={{
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 3.5,
          paddingBottom: 0,
          borderTop: '1px solid var(--jp-border-color1)'
        }}
        sendWithShiftEnter={chatModel.config.sendWithShiftEnter ?? false}
      />
    </>
  );
}

export function Chat(props: Chat.IOptions): JSX.Element {
  const [view, setView] = useState<Chat.ChatView>(
    props.chatView || Chat.ChatView.Chat
  );
  console.log('Instantiate a chat');
  return (
    <JlThemeProvider themeManager={props.themeManager}>
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
          <ChatBody chatModel={props.chatModel} rmRegistry={props.rmRegistry} />
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
    chatModel: IChatModel;
    /**
     * The theme manager.
     */
    themeManager: IThemeManager | null;
    /**
     * The rendermime registry.
     */
    rmRegistry: IRenderMimeRegistry;
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
