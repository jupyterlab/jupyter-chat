/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { CodeToolbar, CodeToolbarProps } from './code-blocks/code-toolbar';
import { MessageToolbar } from './toolbar';
import { IChatModel } from '../model';

const MD_MIME_TYPE = 'text/markdown';
const RENDERMIME_MD_CLASS = 'jp-chat-rendermime-markdown';

type RendermimeMarkdownProps = {
  markdownStr: string;
  rmRegistry: IRenderMimeRegistry;
  appendContent?: boolean;
  model: IChatModel;
  edit?: () => void;
  delete?: () => void;
};

/**
 * Escapes backslashes in LaTeX delimiters such that they appear in the DOM
 * after the initial MarkDown render. For example, this function takes '\(` and
 * returns `\\(`.
 *
 * Required for proper rendering of MarkDown + LaTeX markup in the chat by
 * `ILatexTypesetter`.
 */
function escapeLatexDelimiters(text: string) {
  return text
    .replace('\\(/g', '\\\\(')
    .replace('\\)/g', '\\\\)')
    .replace('\\[/g', '\\\\[')
    .replace('\\]/g', '\\\\]');
}

/**
 * Type predicate function that determines whether a given DOM Node is a Text
 * node.
 */
function isTextNode(node: Node | null): node is Text {
  return node?.nodeType === Node.TEXT_NODE;
}

/**
 * Escapes all `$` symbols present in an HTML element except those within the
 * following elements: `pre`, `code`, `samp`, `kbd`.
 *
 * This prevents `$` symbols from being used as inline math delimiters, allowing
 * `$` symbols to be used literally to denote quantities of USD. This does not
 * escape literal `$` within elements that display their contents literally,
 * like code elements. This overrides JupyterLab's default rendering of MarkDown
 * w/ LaTeX.
 *
 * The Jupyter AI system prompt should explicitly request that the LLM not use
 * `$` as an inline math delimiter. This is the default behavior.
 */
function escapeDollarSymbols(el: HTMLElement) {
  // Get all text nodes that are not within pre, code, samp, or kbd elements
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      const isInSkippedElements = node.parentElement?.closest(
        'pre, code, samp, kbd'
      );
      return isInSkippedElements
        ? NodeFilter.FILTER_SKIP
        : NodeFilter.FILTER_ACCEPT;
    }
  });

  // Collect all valid text nodes in an array.
  const textNodes: Text[] = [];
  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    if (isTextNode(currentNode)) {
      textNodes.push(currentNode);
    }
  }

  // Replace each `$` symbol with `\$` for each text node, unless there is
  // another `$` symbol adjacent or it is already escaped. Examples:
  // - `$10 - $5` => `\$10 - \$5` (escaped)
  // - `$$ \infty $$` => `$$ \infty $$` (unchanged)
  // - `\$10` => `\$10` (unchanged, already escaped)
  textNodes.forEach(node => {
    if (node.textContent) {
      node.textContent = node.textContent.replace(/(?<![$\\])\$(?!\$)/g, '\\$');
    }
  });
}

function RendermimeMarkdownBase(props: RendermimeMarkdownProps): JSX.Element {
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
      // initialize mime model
      const mdStr = escapeLatexDelimiters(props.markdownStr);
      const model = props.rmRegistry.createModel({
        data: { [MD_MIME_TYPE]: mdStr }
      });

      const renderer = props.rmRegistry.createRenderer(MD_MIME_TYPE);

      // step 1: render markdown
      await renderer.renderModel(model);
      props.rmRegistry.latexTypesetter?.typeset(renderer.node);
      if (!renderer.node) {
        throw new Error(
          'Rendermime was unable to render Markdown content within a chat message. Please report this upstream to Jupyter chat on GitHub.'
        );
      }

      // step 2: render LaTeX via MathJax, while escaping single dollar symbols.
      escapeDollarSymbols(renderer.node);
      props.rmRegistry.latexTypesetter?.typeset(renderer.node);

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
    };

    renderContent();
  }, [props.markdownStr, props.rmRegistry]);

  return (
    <div className={RENDERMIME_MD_CLASS}>
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

export const RendermimeMarkdown = React.memo(RendermimeMarkdownBase);
