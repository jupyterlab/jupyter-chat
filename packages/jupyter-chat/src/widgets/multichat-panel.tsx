/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/*
 * Multi-chat panel for @jupyter/chat
 * Originally adapted from jupyterlab-chat's ChatPanel
 */

import { InputDialog } from '@jupyterlab/apputils';
import {
  addIcon,
  closeIcon,
  launchIcon,
  PanelWithToolbar,
  ReactWidget,
  SidePanel,
  Spinner,
  ToolbarButton
} from '@jupyterlab/ui-components';
import { Debouncer } from '@lumino/polling';
import { ISignal, Signal } from '@lumino/signaling';
import { Widget } from '@lumino/widgets';
import React, { useRef, useState } from 'react';

import { ChatWidget } from './chat-widget';
import { ChatSelectorPopup } from './chat-selector-popup';
import {
  Chat,
  IInputToolbarRegistry,
  IInputToolbarRegistryFactory
} from '../components';
import { chatIcon, readIcon } from '../icons';
import { IChatModel } from '../model';

const SIDEPANEL_CLASS = 'jp-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-chat-add';
const OPEN_SELECT_CLASS = 'jp-chat-open';
const SIDEPANEL_WIDGET_CLASS = 'jp-chat-sidepanel-widget';
const TOOLBAR_CLASS = 'jp-chat-sidepanel-widget-toolbar';

/**
 * Generic sidepanel widget including multiple chats and the add chat button.
 */
export class MultiChatPanel extends PanelWithToolbar {
  constructor(options: MultiChatPanel.IOptions) {
    super(options);
    this.id = 'jupyter-chat::multi-chat-panel';
    this.title.icon = chatIcon;
    this.title.caption = 'Jupyter Chat'; // TODO: i18n/

    this.addClass(SIDEPANEL_CLASS);

    this._chatOptions = options;
    this._inputToolbarFactory = options.inputToolbarFactory;

    this._getChatNames = options.getChatNames;
    this._createModel = options.createModel;
    this._openInMain = options.openInMain;
    this._renameChat = options.renameChat;

    if (this._createModel) {
      // Add chat button calls the createChat callback
      const addChat = new ToolbarButton({
        onClick: async () => {
          const addChatArgs = await this._createModel!();
          this.open(addChatArgs);
        },
        icon: addIcon,
        label: 'Chat',
        tooltip: 'Add a new chat'
      });
      addChat.addClass(ADD_BUTTON_CLASS);
      this.toolbar.addItem('createChat', addChat);
    }

    if (this._getChatNames && this._createModel) {
      // Chat selector with search input
      this._openChatWidget = ReactWidget.create(
        <ChatSearchInput
          onChatSelected={this._chatSelected.bind(this)}
          getPopup={() => this._chatSelectorPopup}
        />
      );
      this._openChatWidget.addClass(OPEN_SELECT_CLASS);
      this.toolbar.addItem('openChat', this._openChatWidget);

      // Create the popup widget (attached to document body)
      this._chatSelectorPopup = new ChatSelectorPopup({
        chatNames: [],
        onSelect: async (name: string) => {
          // Check if model is already loaded
          let openChatArgs: MultiChatPanel.IOpenChatArgs = {
            model: this.getLoadedModel(name),
            displayName: name
          };
          // If not, create the model.
          if (!openChatArgs.model && this._createModel) {
            const chatID = this._chatNames[name];
            openChatArgs = await this._createModel(chatID);
          }
          if (openChatArgs.model) {
            this.open(openChatArgs);
          }
          this._chatSelectorPopup?.hide();
        },
        onClose: (name: string) => {
          this.disposeLoadedModel(name);
        }
      });
    }

    // Insert the toolbar as first child.
    this.insertWidget(0, this.toolbar);
    this._updateChatListDebouncer = new Debouncer(this._updateChatList, 200);
  }

  /**
   * The currently displayed chat widget.
   */
  get currentChat(): ChatWidget | undefined {
    return this._currentChat?.widget;
  }

  /**
   * A signal emitting when a chat widget is opened in the panel.
   */
  get chatOpened(): ISignal<MultiChatPanel, ChatWidget> {
    return this._chatOpened;
  }

  /**
   * Add a chat to the panel by creating or showing its widget.
   *
   * @param args - the chat args including model and display name.
   */
  open(args: MultiChatPanel.IOpenChatArgs): ChatWidget | undefined {
    const { model } = args;
    if (!model) {
      return;
    }

    const displayName = args.displayName ?? model.name;

    // Add model to loaded models
    if (!this._loadedModels.has(displayName)) {
      this._loadedModels.set(displayName, model);
      this._chatSelectorPopup?.setLoadedModels(this.getLoadedModelNames());
    }

    // Open this chat (will create widget)
    return this._open(displayName);
  }

  /**
   * Get a loaded model by name, or undefined if not loaded.
   */
  getLoadedModel(name: string): IChatModel | undefined {
    return this._loadedModels.get(name);
  }

  /**
   * Get all loaded model names.
   */
  getLoadedModelNames(): string[] {
    return Array.from(this._loadedModels.keys());
  }

  /**
   * Dispose a model, removing it from loaded models.
   */
  disposeLoadedModel(name: string): void {
    const model = this._loadedModels.get(name);
    if (model) {
      // If this is the currently displayed chat, remove it.
      if (this._currentChat?.model === model) {
        this._currentChat.dispose();
        this._currentChat = undefined;

        // Clear current chat in selector
        if (this._chatSelectorPopup) {
          this._chatSelectorPopup.setCurrentChat(null);
        }
      }

      model.dispose();
      this._loadedModels.delete(name);
      this._chatSelectorPopup?.setLoadedModels(this.getLoadedModelNames());
    }
  }

  /**
   * Open a specific chat by name, creating a new sidepanel widget.
   */
  private _open(name: string): ChatWidget | undefined {
    const model = this._loadedModels.get(name);
    if (!model) {
      return;
    }

    // Dispose current chat widget if any
    if (this._currentChat) {
      this._currentChat.dispose();
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
      displayName: name,
      openInMain: this._openInMain,
      renameChat: this._renameChat,
      onClose: () => {
        this.disposeLoadedModel(name);
      }
    });

    // Add to content panel
    this.addWidget(widget);
    this.update();
    this._currentChat = widget;

    // Update selector to show current chat
    if (this._chatSelectorPopup) {
      this._chatSelectorPopup.setCurrentChat(name);
    }

    this._chatOpened.emit(chatWidget);
    return chatWidget;
  }

  /**
   * Invoke the update of the list of available chats.
   */
  updateChatList() {
    this._updateChatListDebouncer.invoke();
  }

  /**
   * Update the list of available chats.
   */
  private _updateChatList = async (): Promise<void> => {
    try {
      const chatNames = await this._getChatNames?.();
      this._chatNames = chatNames ?? {};
      this._chatSelectorPopup?.updateChats(Object.keys(this._chatNames));
    } catch (e) {
      console.error('Error getting chat files', e);
    }
  };

  /**
   * Open a chat if its model is already loaded.
   *
   * @param name - the name of the chat.
   * @returns a boolean, whether the chat model was already loaded or not.
   */
  openIfLoaded(name: string): boolean {
    const model = this._loadedModels.get(name);
    if (model) {
      this._open(name);
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
    for (const model of this._loadedModels.values()) {
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
   * Handle chat selection from the popup.
   */
  private async _chatSelected(value: string): Promise<void> {
    if (this._createModel) {
      const addChatArgs = await this._createModel(value);
      this.open(addChatArgs);
    }
  }

  private _chatOpened = new Signal<MultiChatPanel, ChatWidget>(this);
  private _chatOptions: Omit<Chat.IOptions, 'model' | 'inputToolbarRegistry'>;
  private _inputToolbarFactory?: IInputToolbarRegistryFactory;
  private _updateChatListDebouncer: Debouncer;

  private _createModel?: (
    name?: string
  ) => Promise<MultiChatPanel.IOpenChatArgs>;
  private _getChatNames?: () => Promise<{ [name: string]: string }>;
  private _openInMain?: (name: string) => Promise<boolean>;
  private _renameChat?: (oldName: string, newName: string) => Promise<boolean>;

  private _openChatWidget?: ReactWidget;
  private _chatSelectorPopup?: ChatSelectorPopup;
  private _loadedModels: Map<string, IChatModel> = new Map();
  private _currentChat?: SidePanelWidget;
  private _chatNames: { [name: string]: string } = {};
}

/**
 * The chat panel namespace.
 */
export namespace MultiChatPanel {
  /**
   * Options of the constructor of the chat panel.
   */
  export interface IOptions
    extends SidePanel.IOptions,
      Omit<Chat.IOptions, 'model' | 'inputToolbarRegistry'> {
    /**
     * The input toolbar factory;
     */
    inputToolbarFactory?: IInputToolbarRegistryFactory;
    /**
     * An optional callback to create a chat model.
     *
     * @param name - the name of the chat, optional.
     * @return an object that can be passed to add a chat section.
     */
    createModel?: (name?: string) => Promise<IOpenChatArgs>;
    /**
     * An optional callback to get the list of existing chats.
     *
     * @returns an object mapping chat display names to identifiers.
     */
    getChatNames?: () => Promise<{ [name: string]: string }>;
    /**
     * An optional callback to open the chat in the main area.
     *
     * @param name - the name of the chat to move.
     */
    openInMain?: (name: string) => Promise<boolean>;
    /**
     * An optional callback to rename a chat.
     *
     * @param oldName - the old name of the chat.
     * @param newName - the new name of the chat.
     * @returns - a boolean, whether the chat has been renamed or not.
     */
    renameChat?: (oldName: string, newName: string) => Promise<boolean>;
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
     * The display name of the chat, shown in the toolbar.
     */
    displayName?: string;
  }
}

/**
 * A widget containing the chat and its toolbar.
 */
class SidePanelWidget extends PanelWithToolbar {
  constructor(options: SidePanelWidget.IOptions) {
    super();
    this._chatWidget = options.widget;
    this._displayName =
      options.displayName ?? options.widget.model.name ?? 'Chat';

    this.addClass(SIDEPANEL_WIDGET_CLASS);
    this.toolbar.addClass(TOOLBAR_CLASS);
    this._updateTitle();

    this.addWidget(this.toolbar);

    // Add spinner while loading
    const spinner = new Spinner();
    this.addWidget(spinner);
    this._chatWidget.model.ready.then(() => {
      spinner.dispose();
    });

    // Add the chat widget
    this.addWidget(this._chatWidget);

    // Add toolbar buttons
    this._markAsRead = new ToolbarButton({
      icon: readIcon,
      iconLabel: 'Mark chat as read',
      className: 'jp-mod-styled',
      onClick: () => {
        if (this.model) {
          this.model.unreadMessages = [];
        }
      }
    });
    this.toolbar.addItem('markRead', this._markAsRead);

    if (options.renameChat) {
      const renameButton = new ToolbarButton({
        iconClass: 'jp-EditIcon',
        iconLabel: 'Rename chat',
        className: 'jp-mod-styled',
        onClick: async () => {
          const oldName = this.model.name ?? 'Chat';
          const result = await InputDialog.getText({
            title: 'Rename Chat',
            text: this.model.name,
            placeholder: 'new-name'
          });
          if (!result.button.accept) {
            return;
          }
          const newName = result.value;
          if (this.model && newName && newName !== oldName) {
            if (await options.renameChat?.(oldName, newName)) {
              this.model.name = newName;
              this._displayName = newName;
              this._updateTitle();
            }
          }
        }
      });
      this.toolbar.addItem('rename', renameButton);
    }

    if (options.openInMain) {
      const moveToMain = new ToolbarButton({
        icon: launchIcon,
        iconLabel: 'Move the chat to the main area',
        className: 'jp-mod-styled',
        onClick: async () => {
          const name = this.model.name;
          if (await options.openInMain?.(name)) {
            this.model.dispose();
            this.dispose();
          }
        }
      });
      this.toolbar.addItem('moveMain', moveToMain);
    }

    const closeButton = new ToolbarButton({
      icon: closeIcon,
      iconLabel: 'Close the chat',
      className: 'jp-mod-styled',
      onClick: () => {
        options.onClose?.();
      }
    });
    this.toolbar.addItem('close', closeButton);

    // Update mark as read button state
    this.model.unreadChanged?.connect(this._unreadChanged);
    this._markAsRead.enabled = (this.model?.unreadMessages.length ?? 0) > 0;
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
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    const model = this.model;
    if (model) {
      model.unreadChanged?.disconnect(this._unreadChanged);
    }
    super.dispose();
  }

  /**
   * Update the title based on the chat name.
   */
  private _updateTitle(): void {
    this.title.label = this.model.name;
    this.title.caption = this._displayName;

    const titleElement = document.createElement('span');
    titleElement.classList.add('jp-chat-sidepanel-toolbar-title');
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
   * Enable/disable unread icon.
   */
  private _unreadChanged = (_: IChatModel, unread: number[]) => {
    this._markAsRead.enabled = unread.length > 0;
  };

  private _chatWidget: ChatWidget;
  private _markAsRead: ToolbarButton;
  private _displayName: string;
  private _titleWidget: Widget | undefined;
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
     * The displayed name of the chat.
     */
    displayName?: string;
    /**
     * The callback to open the chat in main area.
     */
    openInMain?: (name: string) => Promise<boolean>;
    /**
     * The callback to rename the chat.
     */
    renameChat?: (oldName: string, newName: string) => Promise<boolean>;
    /**
     * The callback when closing the chat.
     */
    onClose?: () => void;
  }
}

type ChatSearchInputProps = {
  /**
   * The callback to call when a chat is selected.
   */
  onChatSelected: (value: string) => void;
  /**
   * Function to get the popup widget.
   */
  getPopup: () => ChatSelectorPopup | undefined;
};

/**
 * A search input component for selecting a chat.
 */
function ChatSearchInput({
  onChatSelected,
  getPopup
}: ChatSearchInputProps): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

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
          onChatSelected(value);
          popup.hide();
          setQuery('');
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
      placeholder="Open a chat"
      value={query}
      onChange={handleInputChange}
      onFocus={handleInputFocus}
      onClick={handleInputClick}
      onKeyDown={handleKeyDown}
      className="jp-chat-search-input"
    />
  );
}
