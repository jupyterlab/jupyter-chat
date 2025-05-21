/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMime, IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { PromiseDelegate } from '@lumino/coreutils';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { CodeToolbar, CodeToolbarProps } from './code-blocks/code-toolbar';
import { MessageToolbar } from './toolbar';
import { IChatModel } from '../model';

export const MD_RENDERED_CLASS = 'jp-chat-rendered-markdown';
export const MD_MIME_TYPE = 'text/markdown';

/**
 * A namespace for the MarkdownRenderer.
 */
export namespace MarkdownRenderer {
  /**
   * A generic function to render a markdown string into a DOM element.
   *
   * @param content - the markdown content.
   * @param rmRegistry - the rendermime registry.
   * @returns a promise that resolves to the renderer.
   */
  export async function renderContent(
    content: string,
    rmRegistry: IRenderMimeRegistry
  ): Promise<IRenderMime.IRenderer> {
    // initialize mime model
    const mdStr = escapeLatexDelimiters(content);
    const model = rmRegistry.createModel({
      data: { [MD_MIME_TYPE]: mdStr }
    });

    const renderer = rmRegistry.createRenderer(MD_MIME_TYPE);

    // step 1: render markdown
    await renderer.renderModel(model);
    if (!renderer.node) {
      throw new Error(
        'Rendermime was unable to render Markdown content within a chat message. Please report this upstream to Jupyter chat on GitHub.'
      );
    }

    // step 2: render LaTeX via MathJax.
    rmRegistry.latexTypesetter?.typeset(renderer.node);

    return renderer;
  }

  /**
   * Escapes backslashes in LaTeX delimiters such that they appear in the DOM
   * after the initial MarkDown render. For example, this function takes '\(` and
   * returns `\\(`.
   *
   * Required for proper rendering of MarkDown + LaTeX markup in the chat by
   * `ILatexTypesetter`.
   */
  export function escapeLatexDelimiters(text: string) {
    return text
      .replace(/\\\(/g, '\\\\(')
      .replace(/\\\)/g, '\\\\)')
      .replace(/\\\[/g, '\\\\[')
      .replace(/\\\]/g, '\\\\]');
  }
}

/**
 * The type of the props for the MessageRenderer component.
 */
type MessageRendererProps = {
  /**
   * The string to render.
   */
  markdownStr: string;
  /**
   * The rendermime registry.
   */
  rmRegistry: IRenderMimeRegistry;
  /**
   * The model of the chat.
   */
  model: IChatModel;
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
      const renderer = await MarkdownRenderer.renderContent(
        props.markdownStr,
        props.rmRegistry
      );

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
          { model: props.model, content: preBlock.textContent || '' }
        ]);
      });

      setCodeToolbarDefns(newCodeToolbarDefns);
      setRenderedContent(renderer.node);

      // Resolve the rendered promise.
      props.rendered.resolve();
    };

    renderContent();
  }, [props.markdownStr, props.rmRegistry]);

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
