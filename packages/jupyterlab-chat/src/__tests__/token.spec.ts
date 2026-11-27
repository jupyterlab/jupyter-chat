/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';

import { CHAT_CONTENT_TYPE, chatFileType } from '../token';

describe('chatFileType', () => {
  it('is found for a .chat entry reported by the contents service', () => {
    const registry = new DocumentRegistry({ initialFileTypes: [] });
    registry.addFileType(chatFileType);

    const model = {
      name: 'example.chat',
      path: 'example.chat',
      type: 'file'
    } as Contents.IModel;

    expect(registry.getFileTypeForModel(model).name).toBe('chat');
  });

  it('keeps chat as the content type of the shared model', () => {
    expect(CHAT_CONTENT_TYPE).toBe('chat');
  });
});
