/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { classes } from '@jupyterlab/ui-components';
import React, { useEffect, useRef } from 'react';

import { useChatContext } from '../../context';
import { MarkdownRenderer, MD_RENDERED_CLASS } from '../../markdown-renderer';

const WELCOME_MESSAGE_CLASS = 'jp-chat-welcome-message';

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
  // ref that tracks whether the rendermime node has already been inserted
  const renderingInserted = useRef<boolean>(false);

  /**
   * Effect: use Rendermime to render `props.markdownStr` into an HTML element,
   * and insert it into `renderingContainer` if not yet inserted.
   */
  useEffect(() => {
    const renderContent = async () => {
      const renderer = await MarkdownRenderer.renderContent({
        content,
        rmRegistry
      });

      // insert the rendering into renderingContainer if not yet inserted
      if (renderingContainer.current !== null && !renderingInserted.current) {
        renderingContainer.current.appendChild(renderer.node);
        renderingInserted.current = true;
      }
    };

    renderContent();
  }, [content]);

  return (
    <div className={classes(MD_RENDERED_CLASS, WELCOME_MESSAGE_CLASS)}>
      <div ref={renderingContainer} />
    </div>
  );
}
