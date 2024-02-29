import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import type { IThemeManager } from '@jupyterlab/apputils';

import { Chat } from '../components/chat';
import { chatIcon } from '../icons';
import { ChatHandler } from '../chat-handler';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

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
