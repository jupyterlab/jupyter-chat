/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import { CopyButton } from './copy-button';
import { MessageToolbar } from './toolbar';

const MD_MIME_TYPE = 'text/markdown';
const RENDERMIME_MD_CLASS = 'jp-chat-rendermime-markdown';

type RendermimeMarkdownProps = {
  markdownStr: string;
  rmRegistry: IRenderMimeRegistry;
  appendContent?: boolean;
  edit?: () => void;
  delete?: () => void;
};

/**
 * Takes \( and returns \\(. Escapes LaTeX delimeters by adding extra backslashes where needed for proper rendering by @jupyterlab/rendermime.
 */
function escapeLatexDelimiters(text: string) {
  return text
    .replace('\\(', '\\\\(')
    .replace('\\)', '\\\\)')
    .replace('\\[', '\\\\[')
    .replace('\\]', '\\\\]');
}

function RendermimeMarkdownBase(props: RendermimeMarkdownProps): JSX.Element {
  const appendContent = props.appendContent || false;
  const [renderedContent, setRenderedContent] = useState<HTMLElement | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderContent = async () => {
      const mdStr = escapeLatexDelimiters(props.markdownStr);
      const model = props.rmRegistry.createModel({
        data: { [MD_MIME_TYPE]: mdStr }
      });

      const renderer = props.rmRegistry.createRenderer(MD_MIME_TYPE);
      await renderer.renderModel(model);
      props.rmRegistry.latexTypesetter?.typeset(renderer.node);

      // Attach CopyButton to each <pre> block
      if (containerRef.current && renderer.node) {
        const preBlocks = renderer.node.querySelectorAll('pre');
        preBlocks.forEach(preBlock => {
          const copyButtonContainer = document.createElement('div');
          preBlock.parentNode?.insertBefore(
            copyButtonContainer,
            preBlock.nextSibling
          );
          ReactDOM.render(
            <CopyButton value={preBlock.textContent || ''} />,
            copyButtonContainer
          );
        });
      }

      setRenderedContent(renderer.node);
    };

    renderContent();
  }, [props.markdownStr, props.rmRegistry]);

  return (
    <div ref={containerRef} className={RENDERMIME_MD_CLASS}>
      {renderedContent &&
        (appendContent ? (
          <div ref={node => node && node.appendChild(renderedContent)} />
        ) : (
          <div ref={node => node && node.replaceChildren(renderedContent)} />
        ))}
      <MessageToolbar edit={props.edit} delete={props.delete} />
    </div>
  );
}

export const RendermimeMarkdown = React.memo(RendermimeMarkdownBase);
