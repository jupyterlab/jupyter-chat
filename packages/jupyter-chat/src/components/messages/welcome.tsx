/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import React, { useEffect, useRef } from 'react';

import { useChatContext } from '../../context';

const WELCOME_MESSAGE_CLASS = 'jp-chat-welcome-message';
const MD_MIME_TYPE = 'text/markdown';

/**
 * The component props.
 */
export interface IWelcomeMessageProps {
  /**
   * The content of the welcome message (markdown).
   */
  content: string;
}

/**
 * The welcome message component.
 * This message is displayed on top of the chat messages, and is rendered using a
 * markdown renderer.
 */
export function WelcomeMessage(props: IWelcomeMessageProps): JSX.Element {
  const { rmRegistry } = useChatContext();
  const content = props.content + '\n----\n';

  // ref that tracks the content container to store the rendermime node in
  const renderingContainer = useRef<HTMLDivElement | null>(null);

  /**
   * Effect: use Rendermime to render `props.markdownStr` into an HTML element,
   * and insert it into `renderingContainer` if not yet inserted.
   */
  useEffect(() => {
    let node: HTMLElement | null = null;

    const renderContent = async () => {
      // Render the welcome message using markdown renderer.
      const renderer = rmRegistry.createRenderer(MD_MIME_TYPE);
      const mimeModel = rmRegistry.createModel({
        data: { [MD_MIME_TYPE]: content }
      });
      await renderer.renderModel(mimeModel);

      // Manually trigger the onAfterAttach of the renderer, because the widget will
      // never been attached, only the node.
      // This is necessary to render latex.
      MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);

      node = renderer.node;
      renderingContainer.current?.append(node);
    };

    renderContent();

    return () => {
      if (node && renderingContainer.current?.contains(node)) {
        renderingContainer.current.removeChild(node);
      }
      node = null;
    };
  }, [content]);

  return <div className={WELCOME_MESSAGE_CLASS} ref={renderingContainer}></div>;
}
