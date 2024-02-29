import type { IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton } from '@mui/material';
import { Box } from '@mui/system';
import React, { useState, useEffect } from 'react';

import { JlThemeProvider } from './jl-theme-provider';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ChatSettings } from './chat-settings';
import { ChatHandler } from '../chat-handler';
import { ScrollContainer } from './scroll-container';
import { ChatService } from '../services';

type ChatBodyProps = {
  chatHandler: ChatHandler;
  rmRegistry: IRenderMimeRegistry;
};

function ChatBody({
  chatHandler,
  rmRegistry: renderMimeRegistry
}: ChatBodyProps): JSX.Element {
  const [messages, setMessages] = useState<ChatService.IChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sendWithShiftEnter, setSendWithShiftEnter] = useState(true);

  /**
   * Effect: fetch history and config on initial render
   */
  useEffect(() => {
    async function fetchHistory() {
      try {
        const [history, config] = await Promise.all([
          chatHandler.getHistory(),
          ChatService.getConfig()
        ]);
        setSendWithShiftEnter(config.send_with_shift_enter ?? false);
        setMessages(history.messages);
      } catch (e) {
        console.error(e);
      }
    }

    fetchHistory();
  }, [chatHandler]);

  /**
   * Effect: listen to chat messages
   */
  useEffect(() => {
    function handleChatEvents(message: ChatService.IMessage) {
      if (message.type === 'connection') {
        return;
      } else if (message.type === 'clear') {
        setMessages([]);
        return;
      }

      setMessages(messageGroups => [...messageGroups, message]);
    }

    chatHandler.addListener(handleChatEvents);
    return function cleanup() {
      chatHandler.removeListener(handleChatEvents);
    };
  }, [chatHandler]);

  // no need to append to messageGroups imperatively here. all of that is
  // handled by the listeners registered in the effect hooks above.
  const onSend = async () => {
    setInput('');

    // send message to backend
    chatHandler.sendMessage({ prompt: input });
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
        sendWithShiftEnter={sendWithShiftEnter}
      />
    </>
  );
}

export type ChatProps = {
  chatHandler: ChatHandler;
  themeManager: IThemeManager | null;
  rmRegistry: IRenderMimeRegistry;
  chatView?: ChatView;
};

enum ChatView {
  Chat,
  Settings
}

export function Chat(props: ChatProps): JSX.Element {
  const [view, setView] = useState<ChatView>(props.chatView || ChatView.Chat);
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
          {view !== ChatView.Chat ? (
            <IconButton onClick={() => setView(ChatView.Chat)}>
              <ArrowBackIcon />
            </IconButton>
          ) : (
            <Box />
          )}
          {view === ChatView.Chat ? (
            <IconButton onClick={() => setView(ChatView.Settings)}>
              <SettingsIcon />
            </IconButton>
          ) : (
            <Box />
          )}
        </Box>
        {/* body */}
        {view === ChatView.Chat && (
          <ChatBody
            chatHandler={props.chatHandler}
            rmRegistry={props.rmRegistry}
          />
        )}
        {view === ChatView.Settings && <ChatSettings />}
      </Box>
    </JlThemeProvider>
  );
}
