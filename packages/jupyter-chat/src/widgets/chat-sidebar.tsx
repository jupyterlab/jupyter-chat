/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Chat } from '../components/chat';
import { chatIcon } from '../icons';
import { ChatWidget } from './chat-widget';

export function buildChatSidebar(options: Chat.IOptions): ChatWidget {
  const widget = new ChatWidget(options);
  widget.id = 'jupyter-chat::side-panel';
  widget.title.icon = chatIcon;
  widget.title.caption = 'Jupyter Chat'; // TODO: i18n
  return widget;
}
