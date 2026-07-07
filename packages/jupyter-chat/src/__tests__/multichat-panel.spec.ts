/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ToolbarRegistry } from '@jupyterlab/apputils';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { ObservableList } from '@jupyterlab/observables';
import { ToolbarButton, PanelWithToolbar } from '@jupyterlab/ui-components';
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

  describe('chatToolbarFactory', () => {
    const makeFactory = (items: ToolbarRegistry.IToolbarItem[]) =>
      jest.fn().mockReturnValue(new ObservableList({ values: items }));

    it('should call factory with the panel when a chat is opened', () => {
      const factory = makeFactory([{ name: 'myButton', widget: new Widget() }]);
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: factory
      });
      const model = new MockChatModel();
      const chatWidget = panel.open({ model, displayName: 'test' });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory.mock.calls[0][0].widget).toBe(chatWidget);
      panel.dispose();
    });

    it('should add the created widget to the chat toolbar', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: makeFactory([
          { name: 'myButton', widget: new Widget() }
        ])
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names())).toContain('myButton');
      panel.dispose();
    });

    it('should insert the item before "close"', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: makeFactory([
          { name: 'myButton', widget: new Widget() }
        ])
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      const names = Array.from(toolbar.names());
      expect(names.indexOf('myButton')).toBeLessThan(names.indexOf('close'));
      panel.dispose();
    });

    it('should add all items when factory returns multiple items', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: makeFactory([
          { name: 'item1', widget: new Widget() },
          { name: 'item2', widget: new Widget() }
        ])
      });
      const model = new MockChatModel();
      panel.open({ model, displayName: 'test' });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      const names = Array.from(toolbar.names());
      expect(names).toContain('item1');
      expect(names).toContain('item2');
      panel.dispose();
    });

    it('should call factory again for each newly opened chat', () => {
      const factory = jest.fn().mockImplementation(
        () =>
          new ObservableList<ToolbarRegistry.IToolbarItem>({
            values: [{ name: 'myButton', widget: new Widget() }]
          })
      );
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: factory
      });
      const model1 = new MockChatModel();
      panel.open({ model: model1, displayName: 'chat1' });
      panel.unsetLoadedModel('chat1');

      const model2 = new MockChatModel();
      panel.open({ model: model2, displayName: 'chat2' });

      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory.mock.results[0].value).not.toBe(
        factory.mock.results[1].value
      );
      panel.dispose();
    });
  });
});
