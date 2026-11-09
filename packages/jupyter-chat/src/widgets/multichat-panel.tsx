/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/*
 * Multi-chat panel for @jupyter/chat
 * Originally adapted from jupyterlab-chat's ChatPanel
 */

import {
  InputDialog,
  Notification,
  ToolbarRegistry
} from '@jupyterlab/apputils';
import { IObservableList } from '@jupyterlab/observables';
import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';
import {
  addIcon,
  closeIcon,
  PanelWithToolbar,
  ReactiveToolbar,
  ReactWidget,
  Spinner,
  Toolbar,
  ToolbarButton
} from '@jupyterlab/ui-components';
import { JSONExt } from '@lumino/coreutils';
import { Message, MessageLoop } from '@lumino/messaging';
import { Debouncer } from '@lumino/polling';
import { ISignal, Signal } from '@lumino/signaling';
import { Panel, Widget } from '@lumino/widgets';
import React, { useEffect, useRef, useState } from 'react';

import { ChatSelectorPopup } from './chat-selector-popup';
import { ChatWidget } from './chat-widget';
import { defaultPlaceholder, Placeholder } from './placeholder';
import {
  Chat,
  IInputToolbarRegistry,
  IInputToolbarRegistryFactory
} from '../components';
import { TRANSLATION_DOMAIN } from '../context';
import { chatIcon } from '../icons';
import { IChatModel } from '../model';
import { IChatPanel, IChatPlaceholderFactory } from '../tokens';
import { ChatArea } from '../types';

const SIDEPANEL_CLASS = 'jp-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-chat-add';
const OPEN_SELECT_CLASS = 'jp-chat-open';
const SIDEPANEL_WIDGET_CLASS = 'jp-chat-sidepanel-widget';
// TODO: Drop this workaround class (and related CSS) once we depend on
// @jupyterlab/ui-components >= 4.6.0 (refs - jupyterlab/jupyterlab#18824).
const TOOLBAR_CLASS = 'jp-chat-sidepanel-widget-toolbar';

/**
 * A panel widget with a reactive toolbar.
 */
class ReactivePanelWithToolbar extends Panel {
  constructor() {
    super();
    this._toolbar = new ReactiveToolbar({ noFocusOnClick: true });
  }

  get toolbar(): ReactiveToolbar {
    return this._toolbar;
  }

  private _toolbar: ReactiveToolbar;
}

/**
 * Generic sidepanel widget including multiple chats and the add chat button.
 */
export class MultiChatPanel extends PanelWithToolbar {
  /**
   * The constructor of the multichat panel.
   */
  constructor(options: MultiChatPanel.IOptions) {
    super(options);
    this.id = 'jupyter-chat::multi-chat-panel';
    this.title.icon = chatIcon;

    const translator = options.translator ?? nullTranslator;
    this._trans = translator.load(TRANSLATION_DOMAIN);

    this.title.caption = this._trans.__('Jupyter Chat');

    this.addClass(SIDEPANEL_CLASS);

    this._chatOptions = options;
    this._inputToolbarFactory = options.inputToolbarFactory;
    this._chatToolbarFactory = options.chatToolbarFactory;

    this._getChatNames = options.getChatNames;
    this._createModel = options.createModel;
    this._renameChat = options.renameChat;
    this._placeholderFactory = options.placeholderFactory;

    if (this._createModel) {
      // Add chat button calls the createChat callback
      const addChat = new ToolbarButton({
        onClick: async () => {
          const addChatArgs = await this._createModel!();
          this.open(addChatArgs);
        },
        icon: addIcon,
        label: this._trans.__('New chat'),
        tooltip: this._trans.__('Create a new chat')
      });
      addChat.addClass(ADD_BUTTON_CLASS);
      this.toolbar.addItem('createChat', addChat);
    }

    if (this._getChatNames && this._createModel) {
      // Chat selector with search input
      this._openChatWidget = ReactWidget.create(
        <ChatSearchInput
          selectChat={this._onSelectChat}
          getPopup={() => this._chatSelectorPopup}
          chatOpened={this._chatOpened}
          trans={this._trans}
        />
      );
      this._openChatWidget.addClass(OPEN_SELECT_CLASS);
      this.toolbar.addItem('openChat', this._openChatWidget);

      // Create the popup widget (attached to document body)
      this._chatSelectorPopup = new ChatSelectorPopup({
        chats: {},
        onSelect: this._onSelectChat,
        onClose: (key: string) => {
          this.unsetLoadedModel(key);
        },
        translator
      });
    }

    // Insert the toolbar as first child.
    this.insertWidget(0, this.toolbar);
    this._updateChatListDebouncer = new Debouncer(this._updateChatList, 200);

    // Add the placeholder by default.
    this._addPlaceholder();
  }

  /**
   * The currently displayed chat widget.
   */
  get current(): SidePanelWidget | undefined {
    return this._currentWidget instanceof SidePanelWidget
      ? this._currentWidget
      : undefined;
  }

  /**
   * A signal emitting when a chat panel is opened in the sidepanel.
   */
  get chatOpened(): ISignal<MultiChatPanel, IChatPanel> {
    return this._chatOpened;
  }

  /**
   * A signal emitting when the panel visibility changed.
   */
  get visibilityChanged(): ISignal<MultiChatPanel, boolean> {
    return this._visibilityChanged;
  }

  /**
   * Add a chat to the panel by creating or showing its widget.
   *
   * The chat is identified by `args.key`, defaulting to the display name, or to
   * the model name.
   *
   * @param args - the chat args including model, key and display name.
   */
  open(args: MultiChatPanel.IOpenChatArgs): ChatWidget | undefined {
    const { model } = args;
    if (!model) {
      return;
    }

    const key = args.key ?? args.displayName ?? model.name;

    // Add model to loaded models
    if (!this._loadedModels.has(key)) {
      const name = args.displayName ?? this._chatNames[key] ?? model.name;
      this._loadedModels.set(key, { model, name });
      this._updateLoadedChats();
    }

    // Open this chat (will create widget)
    return this._open(key);
  }

  /**
   * Get a loaded model by chat key, or undefined if not loaded.
   */
  getLoadedModel(key: string): IChatModel | undefined {
    return this._loadedModels.get(key)?.model;
  }

  /**
   * Get the keys of all the loaded chats.
   */
  getLoadedModelKeys(): string[] {
    return Array.from(this._loadedModels.keys());
  }

  /**
   * Update the key and optionally the name of a loaded chat (e.g. when the chat
   * file has been renamed).
   *
   * @param oldKey - the current key of the chat.
   * @param newKey - the new key of the chat.
   * @param name - the new name of the chat, unchanged if not provided.
   */
  updateLoadedChat(oldKey: string, newKey: string, name?: string): void {
    const loaded = this._loadedModels.get(oldKey);
    if (!loaded) {
      return;
    }
    if (newKey !== oldKey) {
      this._loadedModels.delete(oldKey);
      this._loadedModels.set(newKey, loaded);
    }
    const current = this.current;
    if (current?.chatKey === oldKey) {
      current.chatKey = newKey;
      if (name !== undefined) {
        // Updates the loaded chat name through the nameChanged signal.
        current.name = name;
      }
      this._chatSelectorPopup?.setCurrentChat(newKey);
    } else if (name !== undefined) {
      loaded.name = name;
    }
    this._updateLoadedChats();
  }

  /**
   * Removing a model from loaded list.
   * Dispose of the widget and optionally dispose of the model.
   *
   * @param key - the key of the chat.
   * @param dispose - whether to dispose of the model.
   */
  unsetLoadedModel(key: string, dispose = true): void {
    const loaded = this._loadedModels.get(key);
    if (loaded) {
      // If this is the currently displayed chat, remove it.
      if (this.current?.model === loaded.model) {
        this.current.nameChanged.disconnect(this._modelNameChanged);
        this.current.dispose();
        this._currentWidget = undefined;

        // Clear current chat in selector
        if (this._chatSelectorPopup) {
          this._chatSelectorPopup.setCurrentChat(null);
        }
        this._addPlaceholder();
      }

      if (dispose) {
        loaded.model.dispose();
      }
      this._loadedModels.delete(key);
      this._updateLoadedChats();
    }
  }

  /**
   * Send the loaded chats (key and name) to the chat selector.
   */
  private _updateLoadedChats(): void {
    const loaded: { [key: string]: string } = {};
    for (const [key, { name }] of this._loadedModels) {
      loaded[key] = name;
    }
    this._chatSelectorPopup?.setLoadedModels(loaded);
  }

  /**
   * Emit a signal when the panel visibility changed.
   */
  protected onAfterShow(msg: Message): void {
    this._visibilityChanged.emit(true);
  }
  protected onBeforeHide(msg: Message): void {
    this._visibilityChanged.emit(false);
  }

  /**
   * Add a placeholder in the panel.
   */
  private _addPlaceholder(): void {
    const props: Placeholder.IProps = {
      chatNames: this._chatNames,
      open: this._onSelectChat,
      onCreate: this._createModel
        ? async () => {
            const args = await this._createModel!();
            this.open(args);
          }
        : undefined,
      chatNamesChanged: this._chatNamesChanged,
      trans: this._trans
    };
    const placeholder = this._placeholderFactory
      ? this._placeholderFactory.create(props)
      : new defaultPlaceholder(props);
    this.addWidget(placeholder);
    this._currentWidget = placeholder;
  }

  /**
   * Open a specific chat by key, creating a new sidepanel widget.
   */
  private _open(key: string): ChatWidget | undefined {
    const loaded = this._loadedModels.get(key);
    if (!loaded) {
      return;
    }
    const { model, name } = loaded;

    // Dispose of the current chat widget or placeholder.
    if (this._currentWidget) {
      this.current?.nameChanged.disconnect(this._modelNameChanged);
      this._currentWidget.dispose();
    }

    // Create the toolbar registry.
    let inputToolbarRegistry: IInputToolbarRegistry | undefined;
    if (this._inputToolbarFactory) {
      inputToolbarRegistry = this._inputToolbarFactory.create();
    }

    // Create a new widget for this model
    const chatWidget = new ChatWidget({
      model,
      ...this._chatOptions,
      inputToolbarRegistry,
      area: 'sidebar'
    });

    // Create a chat with toolbar
    const widget = new SidePanelWidget({
      widget: chatWidget,
      chatKey: key,
      displayName: name,
      renameChat: this._renameChat,
      toolbarFactory: this._chatToolbarFactory,
      onClose: (key: string, disposeModel = true) => {
        this.unsetLoadedModel(key, disposeModel);
      },
      trans: this._trans
    });

    // Add to content panel
    this.addWidget(widget);
    this.update();
    this._currentWidget = widget;

    this.current?.nameChanged.connect(this._modelNameChanged);

    // Update selector to show current chat
    if (this._chatSelectorPopup) {
      this._chatSelectorPopup.setCurrentChat(key);
    }

    this._chatOpened.emit(widget);
    return chatWidget;
  }

  /**
   * Invoke the update of the list of available chats.
   */
  updateChatList = (): void => {
    this._updateChatListDebouncer.invoke();
  };

  /**
   * Update the list of available chats.
   */
  private _updateChatList = async (): Promise<void> => {
    try {
      const chatNames = (await this._getChatNames?.()) ?? {};
      if (!JSONExt.deepEqual(chatNames, this._chatNames)) {
        this._chatNames = chatNames;
        this._chatSelectorPopup?.updateChats(this._chatNames);
        this._chatNamesChanged.emit(this._chatNames);
      }
    } catch (e) {
      console.error('Error getting chat files', e);
    }
  };

  /**
   * Open a chat if its model is already loaded.
   *
   * @param key - the key of the chat.
   * @returns a boolean, whether the chat model was already loaded or not.
   */
  openIfLoaded(key: string): boolean {
    if (this._loadedModels.has(key)) {
      this._open(key);
      return true;
    }
    return false;
  }

  /**
   * A message handler invoked on an `'after-attach'` message.
   */
  protected onAfterAttach(): void {
    this._openChatWidget?.renderPromise?.then(() => this.updateChatList());

    // Attach the popup to the document body
    if (this._chatSelectorPopup && !this._chatSelectorPopup.isAttached) {
      Widget.attach(this._chatSelectorPopup, document.body);
    }
  }

  /**
   * A message handler invoked on an `'before-detach'` message.
   */
  protected onBeforeDetach(): void {
    // Detach the popup
    if (this._chatSelectorPopup && this._chatSelectorPopup.isAttached) {
      Widget.detach(this._chatSelectorPopup);
    }
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    // Dispose all loaded models
    for (const { model } of this._loadedModels.values()) {
      model.dispose();
    }
    this._loadedModels.clear();

    if (this._chatSelectorPopup) {
      this._chatSelectorPopup.dispose();
      this._chatSelectorPopup = undefined;
    }
    super.dispose();
  }

  /**
   * Update the loaded chat name when the current widget updates its name.
   */
  private _modelNameChanged = (
    widget: SidePanelWidget,
    change: { old: string; new: string }
  ) => {
    const loaded = this._loadedModels.get(widget.chatKey);
    if (loaded) {
      loaded.name = change.new;
      this._updateLoadedChats();
    }
  };

  /**
   * Handle chat selection from the popup or the placeholder.
   *
   * @param key - the key of the selected chat.
   */
  private _onSelectChat = async (key: string): Promise<void> => {
    // Open the model if it is already loaded, otherwise create it.
    if (!this.openIfLoaded(key) && this._createModel) {
      const openChatArgs = await this._createModel(key);
      if (openChatArgs.model) {
        this.open({ ...openChatArgs, key: openChatArgs.key ?? key });
      }
    }
    this._chatSelectorPopup?.hide();
  };

  private _chatOpened = new Signal<MultiChatPanel, IChatPanel>(this);
  private _chatNamesChanged = new Signal<
    MultiChatPanel,
    { [key: string]: string }
  >(this);
  private _chatOptions: Omit<Chat.IOptions, 'model' | 'inputToolbarRegistry'>;
  private _inputToolbarFactory?: IInputToolbarRegistryFactory;
  private _chatToolbarFactory?: (
    panel: IChatPanel
  ) => IObservableList<ToolbarRegistry.IToolbarItem>;
  private _updateChatListDebouncer: Debouncer;

  private _createModel?: (
    key?: string
  ) => Promise<MultiChatPanel.IOpenChatArgs>;
  private _getChatNames?: () => Promise<{ [key: string]: string }>;
  private _renameChat?: boolean | ((key: string) => Promise<string | null>);
  private _placeholderFactory?: IChatPlaceholderFactory;
  private _openChatWidget?: ReactWidget;
  private _chatSelectorPopup?: ChatSelectorPopup;
  private _loadedModels = new Map<
    string,
    { model: IChatModel; name: string }
  >();
  private _currentWidget?: SidePanelWidget | Widget;
  private _chatNames: { [key: string]: string } = {};
  private _visibilityChanged = new Signal<MultiChatPanel, boolean>(this);
  private _trans: TranslationBundle;
}

/**
 * The chat panel namespace.
 */
export namespace MultiChatPanel {
  /**
   * Options of the constructor of the chat panel.
   */
  export interface IOptions
    extends PanelWithToolbar.IOptions,
      Omit<Chat.IOptions, 'model' | 'inputToolbarRegistry'> {
    /**
     * The input toolbar factory;
     */
    inputToolbarFactory?: IInputToolbarRegistryFactory;
    /**
     * An optional toolbar factory for each opened chat.
     */
    chatToolbarFactory?: (
      panel: IChatPanel
    ) => IObservableList<ToolbarRegistry.IToolbarItem>;
    /**
     * An optional callback to create a chat model.
     *
     * @param key - the key of the chat (as returned by `getChatNames`), or
     *   undefined to create a new chat.
     * @return an object that can be passed to open the chat.
     */
    createModel?: (key?: string) => Promise<IOpenChatArgs>;
    /**
     * An optional callback to get the list of existing chats.
     *
     * @returns an object mapping the chat keys to their display names.
     */
    getChatNames?: () => Promise<{ [key: string]: string }>;
    /**
     * An optional callback to rename a chat.
     *
     * If `true`, the user is prompted for a new name, which is set to the
     * model and the displayed name.
     * If a function, it is called with the chat key and returns the new
     * displayed name, or null if the chat has not been renamed.
     */
    renameChat?: boolean | ((key: string) => Promise<string | null>);
    /**
     * An optional factory to create a placeholder widget displayed when no chat
     * is opened. Falls back to the default placeholder if not provided.
     *
     * @param props - the props passed to the placeholder.
     * @returns a widget to display as placeholder.
     */
    placeholderFactory?: IChatPlaceholderFactory;
  }
  /**
   * The options for the add chat method.
   */
  export interface IOpenChatArgs {
    /**
     * The model of the chat.
     * No-op if undefined.
     */
    model?: IChatModel;
    /**
     * The unique key of the chat in the panel (e.g. the value returned by
     * `getChatNames`). Defaults to the display name, or to the model name.
     */
    key?: string;
    /**
     * The display name of the chat, shown in the toolbar.
     */
    displayName?: string;
  }
}

/**
 * A widget containing the chat and its toolbar.
 */
class SidePanelWidget extends ReactivePanelWithToolbar implements IChatPanel {
  constructor(options: SidePanelWidget.IOptions) {
    super();
    this._chatWidget = options.widget;
    this._chatKey = options.chatKey;
    this._displayName = options.displayName ?? options.widget.model.name;
    const trans = options.trans;

    this.addClass(SIDEPANEL_WIDGET_CLASS);
    // Keep side-panel toolbar baseline sizing from ui-components.
    this.toolbar.addClass('jp-SidePanel-toolbar');
    this.toolbar.addClass(TOOLBAR_CLASS);
    this._updateTitle();
    this.toolbar.addItem('titleSpacer', Toolbar.createSpacerItem());

    this.addWidget(this.toolbar);

    // Add spinner while loading
    const spinner = new Spinner();
    this.addWidget(spinner);
    this._chatWidget.model.ready
      .then(() => {
        spinner.dispose();
      })
      .catch(() => {
        // The chat could not be opened (e.g. the server closed the WebSocket
        // because the path was invalid). Dispose the spinner and close this
        // chat so no loading spinner is left hanging; the side panel stays open.
        spinner.dispose();
        Notification.error(
          trans.__(
            "Unable to open chat at given path: '%1'.",
            this._chatWidget.model.name
          )
        );
        options.onClose(this._chatKey);
      });

    // Add the chat widget
    this.addWidget(this._chatWidget);

    if (options.renameChat) {
      const renameButton = new ToolbarButton({
        iconClass: 'jp-EditIcon',
        iconLabel: trans.__('Rename chat'),
        className: 'jp-mod-styled',
        onClick: async () => {
          if (!options.renameChat) {
            return;
          }
          let newName: string | null;
          if (options.renameChat === true) {
            // If rename chat is true, let's provide a input to select new name.
            const result = await InputDialog.getText({
              title: trans.__('Rename Chat'),
              text: this.model.name,
              placeholder: trans.__('new-name')
            });
            if (!result.button.accept && result.value) {
              return;
            }
            newName = result.value;
            if (newName) {
              this.model.name = newName;
            }
          } else {
            // Rename chat is a function, let's call it.
            newName = await options.renameChat(this._chatKey);
          }
          if (newName) {
            this.name = newName;
          }
        }
      });
      this.toolbar.addItem('rename', renameButton);
    }

    const closeButton = new ToolbarButton({
      icon: closeIcon,
      iconLabel: trans.__('Close the chat'),
      className: 'jp-mod-styled',
      onClick: () => {
        options.onClose(this._chatKey);
      }
    });
    this.toolbar.addItem('close', closeButton);

    if (options.toolbarFactory) {
      const items = options.toolbarFactory(this);
      for (let i = 0; i < items.length; i++) {
        const { name, widget } = items.get(i);
        this.toolbar.insertBefore('close', name, widget);
      }
      items.changed.connect((_, change) => {
        if (change.type === 'add') {
          for (const { name, widget } of change.newValues) {
            this.toolbar.insertBefore('close', name, widget);
          }
        } else if (change.type === 'remove') {
          for (const { widget } of change.oldValues) {
            widget.dispose();
          }
        }
      });
    }
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    requestAnimationFrame(() => this._updateReactiveToolbar());
  }

  protected onResize(msg: Widget.ResizeMessage): void {
    super.onResize(msg);
    this._updateReactiveToolbar();
  }

  /**
   * The area of the widget.
   */
  get area(): ChatArea {
    return 'sidebar';
  }

  /**
   * The chat widget embedded in the sidepanel widget.
   */
  get widget(): ChatWidget {
    return this._chatWidget;
  }

  /**
   * The model of the widget.
   */
  get model(): IChatModel {
    return this._chatWidget.model;
  }

  /**
   * The key of the chat in the panel.
   */
  get chatKey(): string {
    return this._chatKey;
  }
  set chatKey(value: string) {
    this._chatKey = value;
  }

  /**
   * The displayed name of the widget.
   */
  get name(): string {
    return this._displayName;
  }
  set name(value: string) {
    const old = this._displayName;
    if (old === value) {
      return;
    }
    this._displayName = value;
    this._updateTitle();
    this._nameChanged.emit({ old, new: value });
  }

  /**
   * A signal emitting when the name has changed.
   */
  get nameChanged(): ISignal<SidePanelWidget, { old: string; new: string }> {
    return this._nameChanged;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    super.dispose();
  }

  /**
   * Update the title based on the chat name.
   */
  private _updateTitle(): void {
    this.title.label = this.model.name;
    this.title.caption = this._displayName;

    const titleElement = document.createElement('span');
    titleElement.classList.add('jp-chat-sidepanel-widget-title');
    titleElement.title = this._displayName;
    titleElement.textContent = this._displayName;

    // Dispose of the previous widget.
    if (this._titleWidget) {
      this._titleWidget.dispose();
    }

    // Insert the new title widget in toolbar.
    this._titleWidget = new Widget({ node: titleElement });
    this.toolbar.insertItem(0, 'title', this._titleWidget);
  }

  /**
   * Trigger reactive toolbar overflow computation from rendered toolbar size.
   */
  private _updateReactiveToolbar(): void {
    const toolbarWidth = this.toolbar.node.offsetWidth;
    if (toolbarWidth <= 0) {
      return;
    }
    const toolbarHeight = this.toolbar.node.offsetHeight;
    MessageLoop.sendMessage(
      this.toolbar,
      new Widget.ResizeMessage(toolbarWidth, toolbarHeight)
    );
  }

  private _chatWidget: ChatWidget;
  private _chatKey: string;
  private _displayName: string;
  private _titleWidget: Widget | undefined;
  private _nameChanged = new Signal<
    SidePanelWidget,
    { old: string; new: string }
  >(this);
}

/**
 * The sidepanel widget namespace.
 */
namespace SidePanelWidget {
  /**
   * The sidepanel widget constructor options.
   */
  export interface IOptions {
    /**
     * The chat widget.
     */
    widget: ChatWidget;
    /**
     * The key of the chat in the panel.
     */
    chatKey: string;
    /**
     * The callback when closing the chat, called with the chat key.
     */
    onClose: (key: string, disposeModel?: boolean) => void;
    /**
     * The displayed name of the chat.
     */
    displayName?: string;
    /**
     * The callback to rename the chat.
     */
    renameChat?: boolean | ((key: string) => Promise<string | null>);
    /**
     * An optional toolbar factory.
     */
    toolbarFactory?: (
      panel: IChatPanel
    ) => IObservableList<ToolbarRegistry.IToolbarItem>;
    /**
     * The translation bundle.
     */
    trans: TranslationBundle;
  }
}

type ChatSearchInputProps = {
  /**
   * The callback to call when a chat is selected.
   */
  selectChat: (value: string) => void;
  /**
   * Function to get the popup widget.
   */
  getPopup: () => ChatSelectorPopup | undefined;
  /**
   * Signal emitting when a chat is opened.
   */
  chatOpened: ISignal<MultiChatPanel, IChatPanel>;
  /**
   * The translation bundle.
   */
  trans: TranslationBundle;
};

/**
 * A search input component for selecting a chat.
 */
function ChatSearchInput({
  selectChat,
  getPopup,
  chatOpened,
  trans
}: ChatSearchInputProps): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const resetQuery = () => {
      setQuery('');
    };
    chatOpened.connect(resetQuery);

    return () => {
      chatOpened.disconnect(resetQuery);
    };
  }, [chatOpened]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    const popup = getPopup();
    if (popup) {
      popup.setQuery(value);
      if (!popup.isVisible && value) {
        popup.show();
      }
    }
  };

  const handleInputFocus = () => {
    const popup = getPopup();
    if (popup && inputRef.current) {
      // Set anchor element before showing
      popup.anchor = inputRef.current;
      popup.setQuery(query);
      popup.show();
    }
  };

  const handleInputClick = () => {
    const popup = getPopup();
    if (popup && inputRef.current && !popup.isVisible) {
      popup.anchor = inputRef.current;
      popup.setQuery(query);
      popup.show();
    }
    // Force focus on input.
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const popup = getPopup();
    if (!popup || !popup.isVisible) {
      return;
    }

    let value: string | null;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        popup.selectNext();
        break;
      case 'ArrowUp':
        event.preventDefault();
        popup.selectPrevious();
        break;
      case 'Enter':
        event.preventDefault();
        value = popup.getSelectedValue();
        if (value) {
          selectChat(value);
          popup.hide();
        }
        break;
      case 'Escape':
        event.preventDefault();
        popup.hide();
        setQuery('');
        break;
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={trans.__('Select a chat')}
      value={query}
      onChange={handleInputChange}
      onFocus={handleInputFocus}
      onClick={handleInputClick}
      onKeyDown={handleKeyDown}
      className="jp-chat-search-input"
    />
  );
}
