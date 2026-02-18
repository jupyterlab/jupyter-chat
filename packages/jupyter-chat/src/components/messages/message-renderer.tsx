/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMime } from '@jupyterlab/rendermime';
import { PromiseDelegate } from '@lumino/coreutils';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { MessageToolbar } from './toolbar';
import { CodeToolbar, CodeToolbarProps } from '../code-blocks/code-toolbar';
import { useChatContext } from '../../context';
import { IMessageContent } from '../../types';
import { replaceMentionToSpan } from '../../utils';

const RENDERED_CLASS = 'jp-chat-rendered-message';
const DEFAULT_MIME_TYPE = 'text/markdown';

/**
 * The type of the props for the MessageRenderer component.
 */
type MessageRendererProps = {
  /**
   * The string or rendermime bundle to render.
   */
  message: IMessageContent;
  /**
   * The promise to resolve when the message is rendered.
   */
  rendered: PromiseDelegate<void>;
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
  const { message } = props;
  const { model, rmRegistry } = useChatContext();

  // The rendered content, return by the mime renderer.
  const [renderedContent, setRenderedContent] = useState<HTMLElement | null>(
    null
  );

  // Allow edition only on text messages.
  const [canEdit, setCanEdit] = useState<boolean>(false);

  // Each element is a two-tuple with the structure [codeToolbarRoot, codeToolbarProps].
  const [codeToolbarDefns, setCodeToolbarDefns] = useState<
    Array<[HTMLDivElement, CodeToolbarProps]>
  >([]);

  useEffect(() => {
    const renderContent = async () => {
      let isMarkdownRenderer = true;
      let renderer: IRenderMime.IRenderer;
      let mimeModel: IRenderMime.IMimeModel;

      // Create the renderer and the mime model.
      if (typeof message.body === 'string') {
        // Allow editing content for text messages.
        setCanEdit(true);

        // Improve users display in markdown content.
        let mdStr = message.body;
        message.mentions?.forEach(user => {
          mdStr = replaceMentionToSpan(mdStr, user);
        });

        // Body is a string, use the markdown renderer.
        renderer = rmRegistry.createRenderer(DEFAULT_MIME_TYPE);
        mimeModel = rmRegistry.createModel({
          data: { [DEFAULT_MIME_TYPE]: mdStr }
        });
      } else {
        setCanEdit(false);
        // This is a mime bundle.
        let mimeContent = message.body;
        let preferred = rmRegistry.preferredMimeType(
          mimeContent.data,
          'ensure' // Should be changed with 'prefer' if we can handle trusted content.
        );
        if (!preferred) {
          preferred = DEFAULT_MIME_TYPE;
          mimeContent = {
            data: {
              [DEFAULT_MIME_TYPE]: `_No renderer found for [**${Object.keys(mimeContent.data).join(', ')}**] mimetype(s)_`
            }
          };
        }
        renderer = rmRegistry.createRenderer(preferred);

        // Improve users display in markdown content.
        if (preferred === DEFAULT_MIME_TYPE) {
          let mdStr = mimeContent.data[DEFAULT_MIME_TYPE];
          if (mdStr) {
            message.mentions?.forEach(user => {
              mdStr = replaceMentionToSpan(mdStr as string, user);
            });
            mimeContent = {
              ...mimeContent,
              data: {
                ...mimeContent.data,
                [DEFAULT_MIME_TYPE]: mdStr
              }
            };
          }
        } else {
          isMarkdownRenderer = false;
        }

        mimeModel = rmRegistry.createModel(mimeContent);
      }
      await renderer.renderModel(mimeModel);

      // Manually trigger the onAfterAttach of the renderer, because the widget will
      // never been attached, only the node.
      // This is necessary to render latex.
      MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);

      // Add code toolbar if markdown has been rendered.
      if (isMarkdownRenderer) {
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
      }

      // Update the content.
      setRenderedContent(renderer.node);

      // Resolve the rendered promise.
      props.rendered.resolve();
    };

    renderContent();
  }, [message.body, message.mentions, rmRegistry]);

  return (
    <>
      {renderedContent && (
        <div
          className={RENDERED_CLASS}
          ref={node => node && node.replaceChildren(renderedContent)}
        />
      )}
      <MessageToolbar
        edit={canEdit ? props.edit : undefined}
        delete={props.delete}
      />
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
    </>
  );
}

export const MessageRenderer = React.memo(MessageRendererBase);
