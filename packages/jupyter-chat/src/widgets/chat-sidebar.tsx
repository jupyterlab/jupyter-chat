/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactWidget } from '@jupyterlab/apputils';
import React from 'react';

import { Chat } from '../components/chat';
import { chatIcon } from '../icons';

export function buildChatSidebar(options: Chat.IOptions): ReactWidget {
  const ChatWidget = ReactWidget.create(<Chat {...options} />);
  ChatWidget.id = 'jupyter-chat::side-panel';
  ChatWidget.title.icon = chatIcon;
  ChatWidget.title.caption = 'Jupyter Chat'; // TODO: i18n
  return ChatWidget;
}
