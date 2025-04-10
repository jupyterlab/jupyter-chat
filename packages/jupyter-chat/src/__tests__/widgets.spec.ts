/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Example of [Jest](https://jestjs.io/docs/getting-started) unit tests
 */

import {
  IRenderMimeRegistry,
  RenderMimeRegistry
} from '@jupyterlab/rendermime';
import { IChatModel } from '../model';
import { ChatWidget } from '../widgets/chat-widget';
import { MockChatModel } from './mocks';

describe('test chat widget', () => {
  let model: IChatModel;
  let rmRegistry: IRenderMimeRegistry;

  beforeEach(() => {
    model = new MockChatModel();
    rmRegistry = new RenderMimeRegistry();
  });

  describe('model instantiation', () => {
    it('should create an AbstractChatModel', () => {
      const widget = new ChatWidget({ model, rmRegistry });
      expect(widget).toBeInstanceOf(ChatWidget);
    });

    it('should dispose an AbstractChatModel', () => {
      const widget = new ChatWidget({ model, rmRegistry });
      widget.dispose();
      expect(widget.isDisposed).toBeTruthy();
    });

    it('should provides the model', () => {
      const widget = new ChatWidget({ model, rmRegistry });
      expect(widget.model).toBe(model);
    });
  });
});
