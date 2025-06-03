/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMime, IRenderMimeRegistry } from '@jupyterlab/rendermime';

export const MD_RENDERED_CLASS = 'jp-chat-rendered-markdown';
export const MD_MIME_TYPE = 'text/markdown';

/**
 * A namespace for the MarkdownRenderer.
 */
export namespace MarkdownRenderer {
  /**
   * The options for the MarkdownRenderer.
   */
  export interface IOptions {
    /**
     * The rendermime registry.
     */
    rmRegistry: IRenderMimeRegistry;
    /**
     * The markdown content.
     */
    content: string;
  }

  /**
   * A generic function to render a markdown string into a DOM element.
   *
   * @param content - the markdown content.
   * @param rmRegistry - the rendermime registry.
   * @returns a promise that resolves to the renderer.
   */
  export async function renderContent(
    options: IOptions
  ): Promise<IRenderMime.IRenderer> {
    const { rmRegistry, content } = options;

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
