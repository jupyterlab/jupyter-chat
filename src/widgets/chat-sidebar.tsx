import { IThemeManager, ReactWidget } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React from 'react';

import { Chat } from '../components/chat';
import { ChatHandler } from '../chat-handler';
import { chatIcon } from '../icons';

export function buildChatSidebar(
  chatHandler: ChatHandler,
  themeManager: IThemeManager | null,
  rmRegistry: IRenderMimeRegistry
): ReactWidget {
  const ChatWidget = ReactWidget.create(
    <Chat
      chatHandler={chatHandler}
      themeManager={themeManager}
      rmRegistry={rmRegistry}
    />
  );
  ChatWidget.id = 'jupyter-chat::side-panel';
  ChatWidget.title.icon = chatIcon;
  ChatWidget.title.caption = 'Jupyter Chat'; // TODO: i18n
  return ChatWidget;
}
