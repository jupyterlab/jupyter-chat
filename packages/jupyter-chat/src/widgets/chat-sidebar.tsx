/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { nullTranslator } from '@jupyterlab/translation';

import { Chat } from '../components/chat';
import { chatIcon } from '../icons';
import { ChatWidget } from './chat-widget';

const TRANSLATION_DOMAIN = 'jupyterlab_chat';

export function buildChatSidebar(options: Chat.IOptions): ChatWidget {
  const widget = new ChatWidget(options);
  const trans = (options.translator ?? nullTranslator).load(TRANSLATION_DOMAIN);
  widget.id = 'jupyter-chat::side-panel';
  widget.title.icon = chatIcon;
  widget.title.caption = trans.__('Jupyter Chat');
  return widget;
}
