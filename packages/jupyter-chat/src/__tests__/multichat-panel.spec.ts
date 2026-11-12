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

function namedModel(name: string): MockChatModel {
  const model = new MockChatModel();
  model.name = name;
  return model;
}

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
      model.name = 'test-chat';
      panel.open({ model });

      panel.unsetLoadedModel('test-chat');

      expect(model.isDisposed).toBe(true);
      panel.dispose();
    });

    it('should not dispose the model when dispose=false', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      model.name = 'test-chat';
      panel.open({ model });

      panel.unsetLoadedModel('test-chat', false);

      expect(model.isDisposed).toBe(false);
      model.dispose();
      panel.dispose();
    });

    it('should dispose the model when clicking the close button', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const { MockChatModel } = await import('./mocks');
      const model = new MockChatModel();
      model.name = 'test-chat';
      panel.open({ model });

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
      model.name = 'test-chat';
      panel.open({ model });

      panel.unsetLoadedModel('test-chat', false);

      expect(panel.getLoadedModel('test-chat')).toBeUndefined();
      model.dispose();
      panel.dispose();
    });
  });

  describe('chat key', () => {
    it('should key the loaded models by key, not by display name', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const model1 = new MockChatModel();
      const model2 = new MockChatModel();
      model1.name = 'chat';
      panel.open({ model: model1, key: 'a/chat.chat' });
      model2.name = 'chat';
      panel.open({ model: model2, key: 'b/chat.chat' });

      expect(panel.getLoadedModel('a/chat.chat')).toBe(model1);
      expect(panel.getLoadedModel('b/chat.chat')).toBe(model2);
      expect(panel.getLoadedModel('chat')).toBeUndefined();
      expect(panel.getLoadedModelKeys()).toEqual([
        'a/chat.chat',
        'b/chat.chat'
      ]);
      panel.dispose();
    });

    it('should display the name and keep the key of the current chat', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      panel.open({
        model: namedModel('a'),
        key: 'chats/a.chat'
      });

      expect(panel.current?.chatKey).toBe('chats/a.chat');
      expect(panel.current?.name).toBe('a');
      panel.dispose();
    });

    it('should open a loaded chat by key', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const model = new MockChatModel();
      model.name = 'a';
      panel.open({ model, key: 'chats/a.chat' });
      panel.open({
        model: namedModel('b'),
        key: 'chats/b.chat'
      });

      expect(panel.openIfLoaded('a')).toBe(false);
      expect(panel.openIfLoaded('chats/a.chat')).toBe(true);
      expect(panel.current?.model).toBe(model);
      panel.dispose();
    });

    it('should update the key of a loaded chat', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const model = new MockChatModel();
      model.name = 'a';
      panel.open({ model, key: 'chats/a.chat' });

      panel.updateLoadedChat('chats/a.chat', 'chats/b.chat');

      expect(panel.getLoadedModel('chats/a.chat')).toBeUndefined();
      expect(panel.getLoadedModel('chats/b.chat')).toBe(model);
      expect(panel.current?.chatKey).toBe('chats/b.chat');
      expect(panel.current?.name).toBe('a');

      // Closing the chat uses the new key.
      panel.unsetLoadedModel('chats/b.chat');
      expect(model.isDisposed).toBe(true);
      panel.dispose();
    });

    it('should create the model from the key selected in the placeholder', async () => {
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const model = namedModel('a');
      const createModel = jest.fn().mockResolvedValue({ model });
      const panel = new MultiChatPanel({
        rmRegistry,
        placeholderFactory: factory,
        createModel
      });
      const props = (factory.create as jest.Mock).mock
        .calls[0][0] as Placeholder.IProps;

      await props.open('chats/a.chat');

      expect(createModel).toHaveBeenCalledWith('chats/a.chat');
      expect(panel.getLoadedModel('chats/a.chat')).toBe(model);
      expect(panel.current?.name).toBe('a');
      panel.dispose();
    });
  });

  describe('model name', () => {
    it('should emit nameChanged only when the name changes', () => {
      const model = new MockChatModel();
      const names: string[] = [];
      model.nameChanged.connect((_, name) => names.push(name));
      model.name = 'a';
      model.name = 'a';
      model.name = 'b';
      expect(names).toEqual(['a', 'b']);
      model.dispose();
    });

    it('should display the new model name of the current chat', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const model = new MockChatModel();
      model.name = 'a';
      panel.open({ model, key: 'chats/a.chat' });

      model.name = 'My chat';

      expect(panel.current?.name).toBe('My chat');
      expect(panel.current?.title.label).toBe('My chat');
      expect(
        panel.current?.node.querySelector('.jp-chat-name')?.textContent
      ).toBe('My chat');
      expect(panel.current?.chatKey).toBe('chats/a.chat');
      panel.dispose();
    });

    it('should use the new model name when reopening a chat', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const model = new MockChatModel();
      model.name = 'a';
      panel.open({ model, key: 'chats/a.chat' });
      panel.open({
        model: namedModel('b'),
        key: 'chats/b.chat'
      });

      // The model name changes while the chat is not displayed.
      model.name = 'My chat';
      panel.openIfLoaded('chats/a.chat');

      expect(panel.current?.name).toBe('My chat');
      panel.dispose();
    });

    it('should not follow the model name once the chat is closed', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      const model = new MockChatModel();
      model.name = 'a';
      panel.open({ model, key: 'chats/a.chat' });
      panel.unsetLoadedModel('chats/a.chat', false);

      model.name = 'My chat';

      expect(panel.getLoadedModel('chats/a.chat')).toBeUndefined();
      model.dispose();
      panel.dispose();
    });

    it('should update the chat list with the new model name', async () => {
      const getChatNames = jest
        .fn()
        .mockResolvedValue({ 'chats/a.chat': 'a', 'chats/b.chat': 'b' });
      const factory: IChatPlaceholderFactory = {
        create: jest.fn().mockReturnValue(new Widget())
      };
      const panel = new MultiChatPanel({
        rmRegistry,
        getChatNames,
        placeholderFactory: factory
      });
      await (panel as any)._updateChatList();

      const props = (factory.create as jest.Mock).mock
        .calls[0][0] as Placeholder.IProps;
      const emitted: { [key: string]: string }[] = [];
      props.chatNamesChanged!.connect((_, names) => emitted.push(names));

      const model = new MockChatModel();
      model.name = 'a';
      panel.open({ model, key: 'chats/a.chat' });
      model.name = 'My chat';

      expect(emitted).toEqual([
        { 'chats/a.chat': 'My chat', 'chats/b.chat': 'b' }
      ]);

      // The unloaded chat is listed with the new name, without fetching the
      // chat list again.
      panel.unsetLoadedModel('chats/a.chat');
      const calls = (factory.create as jest.Mock).mock.calls;
      const newProps = calls[calls.length - 1][0] as Placeholder.IProps;
      expect(newProps.chatNames).toEqual({
        'chats/a.chat': 'My chat',
        'chats/b.chat': 'b'
      });
      expect(getChatNames).toHaveBeenCalledTimes(1);
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
      model.name = 'test-chat';
      panel.open({ model });
      panel.unsetLoadedModel('test-chat');

      expect(factory.create).toHaveBeenCalledTimes(2);
      panel.dispose();
    });
  });

  describe('side panel toolbar', () => {
    it('should include the responsive toolbar opener for overflow actions', async () => {
      const panel = new MultiChatPanel({ rmRegistry });
      panel.open({ model: namedModel('test-chat') });

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
      model.name = 'test';
      const chatWidget = panel.open({ model });
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
      model.name = 'test';
      panel.open({ model });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names())).toContain('myButton');
      panel.dispose();
    });

    it('should insert the items at the beginning of the toolbar', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: makeFactory([
          { name: 'item1', widget: new Widget() },
          { name: 'item2', widget: new Widget() }
        ])
      });
      panel.open({ model: namedModel('test') });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names()).slice(0, 2)).toEqual([
        'item1',
        'item2'
      ]);
      panel.dispose();
    });

    it('should insert the items added later at their index', () => {
      const items = new ObservableList<ToolbarRegistry.IToolbarItem>({
        values: [
          { name: 'item1', widget: new Widget() },
          { name: 'item3', widget: new Widget() }
        ]
      });
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: jest.fn().mockReturnValue(items)
      });
      panel.open({ model: namedModel('test') });

      items.insert(1, { name: 'item2', widget: new Widget() });

      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names()).slice(0, 3)).toEqual([
        'item1',
        'item2',
        'item3'
      ]);
      panel.dispose();
    });

    it('should not add the default title when a factory is provided', () => {
      const panel = new MultiChatPanel({
        rmRegistry,
        chatToolbarFactory: makeFactory([
          { name: 'myButton', widget: new Widget() }
        ])
      });
      panel.open({ model: namedModel('test') });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names())).not.toContain('chatName');
      panel.dispose();
    });

    it('should add the default title when no factory is provided', () => {
      const panel = new MultiChatPanel({ rmRegistry });
      panel.open({ model: namedModel('test') });
      const toolbar = (panel.current as unknown as PanelWithToolbar).toolbar;
      expect(Array.from(toolbar.names()).slice(0, 2)).toEqual([
        'chatName',
        'chatNameSpacer'
      ]);
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
      model.name = 'test';
      panel.open({ model });
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
      model1.name = 'chat1';
      panel.open({ model: model1 });
      panel.unsetLoadedModel('chat1');

      const model2 = new MockChatModel();
      model2.name = 'chat2';
      panel.open({ model: model2 });

      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory.mock.results[0].value).not.toBe(
        factory.mock.results[1].value
      );
      panel.dispose();
    });
  });
});
