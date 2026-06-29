/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ToolbarButton } from '@jupyterlab/ui-components';
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

  describe('unsetLoadedModel', () => {
    it('should dispose the model by default', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test-chat' });

      panel.unsetLoadedModel('test-chat');

      expect(model.isDisposed).toBe(true);
      panel.dispose();
    });

    it('should not dispose the model when dispose=false', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test-chat' });

      panel.unsetLoadedModel('test-chat', false);

      expect(model.isDisposed).toBe(false);
      model.dispose();
      panel.dispose();
    });

    it('should dispose the model when clicking the close button', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test-chat' });

      const toolbar = panel.current!.toolbar;
      const names = Array.from(toolbar.names());
      const closeIdx = names.indexOf('close');
      expect(closeIdx).toBeGreaterThan(-1);

      const closeButton = (toolbar.layout as any).widgets[
        closeIdx
      ] as ToolbarButton;

      closeButton.onClick();

      expect(model.isDisposed).toBe(true);
      panel.dispose();
    });

    it('should remove the model from loaded models regardless of dispose flag', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test-chat' });

      panel.unsetLoadedModel('test-chat', false);

      expect(panel.getLoadedModel('test-chat')).toBeUndefined();
      model.dispose();
      panel.dispose();
    });
  });

  describe('openInMain', () => {
    it('should not dispose the model when moving to main area', async () => {
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      const openInMain = jest.fn().mockResolvedValue(true);

      const panel = new MultiChatPanel({ rmRegistry, openInMain });
      panel.open({ model, displayName: 'test-chat' });

      // Find the 'moveMain' toolbar button by name and invoke its click handler directly.
      // ToolbarButton stores the onClick handler independently of DOM/React rendering,
      // so this works without attaching the widget to the document.
      const toolbar = panel.current!.toolbar;
      const names = Array.from(toolbar.names());
      const moveMainIdx = names.indexOf('moveMain');
      expect(moveMainIdx).toBeGreaterThan(-1);

      const moveButton = (toolbar.layout as any).widgets[
        moveMainIdx
      ] as ToolbarButton;

      moveButton.onClick();
      // Wait for the async onClick handler: openInMain resolves, then onClose is called.
      await Promise.resolve();

      expect(openInMain).toHaveBeenCalledWith(model.name);
      expect(model.isDisposed).toBe(false);
      expect(panel.getLoadedModel('test-chat')).toBeUndefined();

      model.dispose();
      panel.dispose();
    });
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
      panel.unsetLoadedModel('test-chat');

      expect(factory.create).toHaveBeenCalledTimes(2);
      panel.dispose();
    });
  });
});
