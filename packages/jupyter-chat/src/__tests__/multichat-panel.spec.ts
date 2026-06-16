/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';

import { IChatPlaceholderFactory } from '../tokens';
import { MultiChatPanel } from '../widgets/multichat-panel';
import { defaultPlaceholder, Placeholder } from '../widgets/placeholder';

describe('MultiChatPanel', () => {
  let rmRegistry: RenderMimeRegistry;

  beforeEach(() => {
    rmRegistry = new RenderMimeRegistry();
  });

  describe('placeholderFactory', () => {
    it('should use defaultPlaceholder when no factory is provided', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const placeholder = Array.from(panel.widgets).find(
        w => w instanceof defaultPlaceholder
      );
      expect(placeholder).toBeInstanceOf(defaultPlaceholder);
      panel.dispose();
    });

    it('should call factory.create when a factory is provided', () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory
      });
      expect(factory.create).toHaveBeenCalledTimes(1);
      panel.dispose();
    });

    it('should add the widget returned by the factory to the panel', () => {
      const customWidget = new Widget();
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(customWidget)
      };
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory
      });
      expect(Array.from(panel.widgets)).toContain(customWidget);
      panel.dispose();
    });

    it('should not use defaultPlaceholder when a factory is provided', () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory
      });
      const placeholder = Array.from(panel.widgets).find(
        w => w instanceof defaultPlaceholder
      );
      expect(placeholder).toBeUndefined();
      panel.dispose();
    });

    it('should pass empty chatNames in props when no chats are loaded', () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory
      });
      const props = (factory.create as jest.Mock).mock
        .calls[0][0] as Placeholder.IProps;
      expect(props.chatNames).toEqual({});
      panel.dispose();
    });

    it('should pass undefined onCreate when createModel is not provided', () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory
      });
      const props = (factory.create as jest.Mock).mock
        .calls[0][0] as Placeholder.IProps;
      expect(props.onCreate).toBeUndefined();
      panel.dispose();
    });

    it('should pass onCreate when createModel is provided', () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const createModel = jest.fn().mockResolvedValue({});
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory,
        createModel
      });
      const props = (factory.create as jest.Mock).mock
        .calls[0][0] as Placeholder.IProps;
      expect(props.onCreate).toBeDefined();
      panel.dispose();
    });

    it('should call factory.create again when the placeholder is re-added after closing a chat', async () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const createModel = jest.fn().mockResolvedValue({});
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory,
        createModel
      });

      // Simulate opening and closing a chat to trigger _addPlaceholder again.
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test-chat' });
      panel.disposeLoadedModel('test-chat');

      expect(factory.create).toHaveBeenCalledTimes(2);
      panel.dispose();
    });
  });
});
