/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PromiseDelegate } from '@lumino/coreutils';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { MessageToolbar } from './toolbar';
import { CodeToolbar, CodeToolbarProps } from '../code-blocks/code-toolbar';
import { useChatContext } from '../../context';
import { MarkdownRenderer, MD_RENDERED_CLASS } from '../../markdown-renderer';

/**
 * The type of the props for the MessageRenderer component.
 */
type MessageRendererProps = {
  /**
   * The string to render.
   */
  markdownStr: string;
  /**
   * The promise to resolve when the message is rendered.
   */
  rendered: PromiseDelegate<void>;
  /**
   * Whether to append the content to the existing content or not.
   */
  appendContent?: boolean;
  /**
   * The function to call to edit a message.
   */
  edit?: () => void;
  /**
   * the function to call to delete a message.
   */
  delete?: () => void;
};

/**
 * The message renderer base component.
 */
function MessageRendererBase(props: MessageRendererProps): JSX.Element {
  const { markdownStr } = props;
  const { model, rmRegistry } = useChatContext();
  const appendContent = props.appendContent || false;
  const [renderedContent, setRenderedContent] = useState<HTMLElement | null>(
    null
  );

  // each element is a two-tuple with the structure [codeToolbarRoot, codeToolbarProps].
  const [codeToolbarDefns, setCodeToolbarDefns] = useState<
    Array<[HTMLDivElement, CodeToolbarProps]>
  >([]);

  useEffect(() => {
    const renderContent = async () => {
      const renderer = await MarkdownRenderer.renderContent({
        content: markdownStr,
        rmRegistry
      });

      const newCodeToolbarDefns: [HTMLDivElement, CodeToolbarProps][] = [];

      // Attach CodeToolbar root element to each <pre> block
      const preBlocks = renderer.node.querySelectorAll('pre');
      preBlocks.forEach(preBlock => {
        const codeToolbarRoot = document.createElement('div');
        preBlock.parentNode?.insertBefore(
          codeToolbarRoot,
          preBlock.nextSibling
        );
        newCodeToolbarDefns.push([
          codeToolbarRoot,
          { model: model, content: preBlock.textContent || '' }
        ]);
      });

      setCodeToolbarDefns(newCodeToolbarDefns);
      setRenderedContent(renderer.node);

      // Resolve the rendered promise.
      props.rendered.resolve();
    };

    renderContent();
  }, [markdownStr, rmRegistry]);

  return (
    <div className={MD_RENDERED_CLASS}>
      {renderedContent &&
        (appendContent ? (
          <div ref={node => node && node.appendChild(renderedContent)} />
        ) : (
          <div ref={node => node && node.replaceChildren(renderedContent)} />
        ))}
      <MessageToolbar edit={props.edit} delete={props.delete} />
      {
        // Render a `CodeToolbar` element underneath each code block.
        // We use ReactDOM.createPortal() so each `CodeToolbar` element is able
        // to use the context in the main React tree.
        codeToolbarDefns.map(codeToolbarDefn => {
          const [codeToolbarRoot, codeToolbarProps] = codeToolbarDefn;
          return createPortal(
            <CodeToolbar {...codeToolbarProps} />,
            codeToolbarRoot
          );
        })
      }
    </div>
  );
}

export const MessageRenderer = React.memo(MessageRendererBase);
