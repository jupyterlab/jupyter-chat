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
import { AbstractChatModel, IChatModel } from '../model';
import { INewMessage } from '../types';
import { ChatWidget } from '../widgets/chat-widget';

class MyChatModel extends AbstractChatModel {
  sendMessage(message: INewMessage): Promise<boolean | void> | boolean | void {
    // No-op
  }
}

describe('test chat widget', () => {
  let model: IChatModel;
  let rmRegistry: IRenderMimeRegistry;

  beforeEach(() => {
    model = new MyChatModel();
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
