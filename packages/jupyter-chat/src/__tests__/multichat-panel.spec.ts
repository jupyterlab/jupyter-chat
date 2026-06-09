/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ToolbarButton } from '@jupyterlab/ui-components';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';

import { IChatPlaceholderFactory } from '../tokens';
import { MultiChatPanel } from '../widgets/multichat-panel';
import { defaultPlaceholder, Placeholder } from '../widgets/placeholder';
import { MockChatModel } from './mocks';

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

    it('should call factory.create again when the placeholder is re-added after closing a chat', () => {
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
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test-chat' });
      panel.unsetLoadedModel('test-chat');

      expect(factory.create).toHaveBeenCalledTimes(2);
      panel.dispose();
    });
  });

  describe('side panel toolbar', () => {
    it('should include the responsive toolbar opener for overflow actions', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');

      panel.open({ model: new MockChatModel(), displayName: 'test-chat' });

      const opener = panel.current?.toolbar.node.querySelector(
        '.jp-Toolbar-responsive-opener'
      );
      expect(opener).not.toBeNull();
      panel.dispose();
    });
  });

  describe('chatToolbarItems', () => {
    it('should call create with the ChatWidget when a chat is opened', () => {
      const customWidget = new Widget();
      const create = jest.fn().mockReturnValue(customWidget);
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarItems: [{ name: 'myButton', create }]
      });
      const model = new MockChatModel();
      const chatWidget = panel.open({ model, displayName: 'test' });
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(chatWidget);
      panel.dispose();
    });

    it('should add the created widget to the chat toolbar', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarItems: [{ name: 'myButton', create: () => new Widget() }]
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names())).toContain('myButton');
      panel.dispose();
    });

    it('should insert the item before "close" by default', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarItems: [{ name: 'myButton', create: () => new Widget() }]
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as PanelWithToolbar).toolbar;
      const names = Array.from(toolbar.names());
      expect(names.indexOf('myButton')).toBeLessThan(names.indexOf('close'));
      panel.dispose();
    });

    it('should insert before the specified item when `before` is set', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarItems: [
          { name: 'myButton', create: () => new Widget(), before: 'markRead' }
        ]
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as PanelWithToolbar).toolbar;
      const names = Array.from(toolbar.names());
      expect(names.indexOf('myButton')).toBeLessThan(names.indexOf('markRead'));
      panel.dispose();
    });

    it('should add all items when multiple chatToolbarItems are provided', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarItems: [
          { name: 'item1', create: () => new Widget() },
          { name: 'item2', create: () => new Widget() }
        ]
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as PanelWithToolbar).toolbar;
      const names = Array.from(toolbar.names());
      expect(names).toContain('item1');
      expect(names).toContain('item2');
      panel.dispose();
    });

    it('should call create again for each newly opened chat', () => {
      const create = jest.fn().mockImplementation(() => new Widget());
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarItems: [{ name: 'myButton', create }]
      });
      const model1 = new MockChatModel();
      panel.open({ model: model1, displayName: 'chat1' });
      panel.disposeLoadedModel('chat1');

      const model2 = new MockChatModel();
      panel.open({ model: model2, displayName: 'chat2' });

      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.results[0].value).not.toBe(
        create.mock.results[1].value
      );
      panel.dispose();
    });
  });
});
