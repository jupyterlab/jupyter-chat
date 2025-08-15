/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

/*
 * Multi-chat panel for @jupyter/chat
 * Originally adapted from jupyterlab-chat's ChatPanel
 */

import {
  ChatWidget,
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IChatModel,
  IInputToolbarRegistry,
  IMessageFooterRegistry,
  readIcon
} from './index';
import { IThemeManager } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { ContentsManager } from '@jupyterlab/services';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import {
  addIcon,
  closeIcon,
  HTMLSelect,
  launchIcon,
  PanelWithToolbar,
  ReactWidget,
  SidePanel,
  Spinner,
  ToolbarButton
} from '@jupyterlab/ui-components';
import { ISignal, Signal } from '@lumino/signaling';
import { AccordionPanel, Panel, Widget } from '@lumino/widgets';
import React, { useState } from 'react';
import { showRenameDialog } from './utils/renameDialog';

const SIDEPANEL_CLASS = 'jp-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-chat-add';
const OPEN_SELECT_CLASS = 'jp-chat-open';
const SECTION_CLASS = 'jp-chat-section';
const TOOLBAR_CLASS = 'jp-chat-toolbar';

/**
 * Generic sidepanel widget including multiple chats and the add chat button.
 */
export class MultiChatPanel extends SidePanel {
  constructor(options: ChatPanel.IOptions) {
    super(options);
    this.addClass(SIDEPANEL_CLASS);

    this._defaultDirectory = options.defaultDirectory;
    this._rmRegistry = options.rmRegistry;
    this._themeManager = options.themeManager;
    this._chatCommandRegistry = options.chatCommandRegistry;
    this._attachmentOpenerRegistry = options.attachmentOpenerRegistry;
    this._inputToolbarFactory = options.inputToolbarFactory;
    this._messageFooterRegistry = options.messageFooterRegistry;
    this._welcomeMessage = options.welcomeMessage;
    this._getChatNames = options.getChatNames;
    this._onChatsChanged = options.onChatsChanged;

    // Use the passed callback functions
    this._openChat = options.openChat ?? (() => {});
    this._createChat = options.createChat ?? (() => {});
    this._closeChat = options.closeChat ?? (() => {});
    this._moveToMain = options.moveToMain ?? (() => {});

    // Add chat button calls the createChat callback
    const addChat = new ToolbarButton({
      onClick: () => this._createChat(),
      icon: addIcon,
      label: 'Chat',
      tooltip: 'Add a new chat'
    });
    addChat.addClass(ADD_BUTTON_CLASS);
    this.toolbar.addItem('createChat', addChat);

    // Chat select dropdown
    this._openChatWidget = ReactWidget.create(
      <ChatSelect
        chatNamesChanged={this._chatNamesChanged}
        handleChange={this._chatSelected.bind(this)}
      />
    );
    this._openChatWidget.addClass(OPEN_SELECT_CLASS);
    this.toolbar.addItem('openChat', this._openChatWidget);

    const content = this.content as AccordionPanel;
    content.expansionToggled.connect(this._onExpansionToggled, this);

    if (this._onChatsChanged) {
      this._onChatsChanged(() => {
        this.updateChatList();
      });
    }
  }

  /**
   * Getter and setter of the defaultDirectory.
   */
  get defaultDirectory(): string {
    return this._defaultDirectory;
  }
  set defaultDirectory(value: string) {
    if (value === this._defaultDirectory) {
      return;
    }
    this._defaultDirectory = value;
    // Update the list of discoverable chat (in default directory)
    this.updateChatList();
    // Update the sections names.
    this.widgets.forEach(w => {
      (w as ChatSection).defaultDirectory = value;
    });
  }

  /**
   * Add a new widget to the chat panel.
   *
   * @param model - the model of the chat widget
   * @param name - the name of the chat.
   */

  addChat(model: IChatModel): ChatWidget {
    const content = this.content as AccordionPanel;
    for (let i = 0; i < this.widgets.length; i++) {
      content.collapse(i);
    }

    // Create the toolbar registry.
    let inputToolbarRegistry: IInputToolbarRegistry | undefined;
    if (this._inputToolbarFactory) {
      inputToolbarRegistry = this._inputToolbarFactory.create();
    }

    // Create a new widget.
    const widget = new ChatWidget({
      model,
      rmRegistry: this._rmRegistry,
      themeManager: this._themeManager,
      chatCommandRegistry: this._chatCommandRegistry,
      attachmentOpenerRegistry: this._attachmentOpenerRegistry,
      inputToolbarRegistry,
      messageFooterRegistry: this._messageFooterRegistry,
      welcomeMessage: this._welcomeMessage
    });

    const section = new ChatSection({
      widget,
      path: model.name,
      defaultDirectory: this._defaultDirectory,
      openChat: this._openChat,
      closeChat: this._closeChat,
      moveToMain: this._moveToMain,
      renameChat: this._renameChat
    });

    this.addWidget(section);
    content.expand(this.widgets.length - 1);

    return widget;
  }

  /**
   * Update the list of available chats in the default directory.
   */
  updateChatList = async (): Promise<void> => {
    try {
      const chatNames = await this._getChatNames();
      console.log('updateChatList emits:', chatNames);
      this._chatNamesChanged.emit(chatNames);
    } catch (e) {
      console.error('Error getting chat files', e);
    }
  };

  /**
   * Open a chat if it exists in the side panel.
   *
   * @param path - the path of the chat.
   * @returns a boolean, whether the chat existed in the side panel or not.
   */
  openIfExists(path: string): boolean {
    const index = this._getChatIndex(path);
    if (index > -1) {
      this._expandChat(index);
    }
    return index > -1;
  }

  /**
   * A message handler invoked on an `'after-attach'` message.
   */
  protected onAfterAttach(): void {
    this._openChatWidget.renderPromise?.then(() => this.updateChatList());
  }

  /**
   * Return the index of the chat in the list (-1 if not opened).
   *
   * @param name - the chat name.
   */
  private _getChatIndex(path: string) {
    return this.widgets.findIndex(w => (w as ChatSection).path === path);
  }

  /**
   * Expand the chat from its index.
   */
  private _expandChat(index: number): void {
    if (!this.widgets[index].isVisible) {
      (this.content as AccordionPanel).expand(index);
    }
  }

  /**
   * Handle `change` events for the HTMLSelect component.
   */
  private _chatSelected(event: React.ChangeEvent<HTMLSelectElement>): void {
    const path = event.target.value;
    if (path === '-') {
      return;
    }
    this._openChat(path);
    event.target.selectedIndex = 0;
  }

  /**
   * Rename a chat.
   */
  private _renameChat = async (
    section: ChatSection,
    path: string,
    newName: string
  ) => {
    try {
      const oldPath = path;
      const newPath = PathExt.join(this.defaultDirectory, newName);

      const ext = '.chat';
      if (!newName.endsWith(ext)) {
        newName += ext;
      }

      const contentsManager = new ContentsManager();
      await contentsManager.rename(oldPath, newPath);

      // Now update UI after backend rename
      section.updateDisplayName(newName);
      section.updatePath(newPath);
      this.updateChatList();

      console.log(`Renamed chat ${oldPath} to ${newPath}`);
    } catch (e) {
      console.error('Error renaming chat', e);
    }
  };

  /**
   * Triggered when a section is toogled. If the section is opened, all others
   * sections are closed.
   */
  private _onExpansionToggled(panel: AccordionPanel, index: number) {
    if (!this.widgets[index].isVisible) {
      return;
    }
    for (let i = 0; i < this.widgets.length; i++) {
      if (i !== index) {
        panel.collapse(i);
      }
    }
  }

  private _chatNamesChanged = new Signal<this, { [name: string]: string }>(
    this
  );

  private _defaultDirectory: string;
  private _rmRegistry: IRenderMimeRegistry;
  private _themeManager: IThemeManager | null;
  private _chatCommandRegistry?: IChatCommandRegistry;
  private _attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
  private _inputToolbarFactory?: ChatPanel.IInputToolbarRegistryFactory;
  private _messageFooterRegistry?: IMessageFooterRegistry;
  private _welcomeMessage?: string;
  private _getChatNames: () => Promise<{ [name: string]: string }>;

  // Replaced command strings with callback functions:
  private _openChat: (path: string) => void;
  private _createChat: () => void;
  private _closeChat: (path: string) => void;
  private _moveToMain: (path: string) => void;

  private _onChatsChanged?: (cb: () => void) => void;
  private _openChatWidget: ReactWidget;
}

/**
 * The chat panel namespace.
 */
export namespace ChatPanel {
  /**
   * Options of the constructor of the chat panel.
   */
  export interface IOptions extends SidePanel.IOptions {
    rmRegistry: IRenderMimeRegistry;
    themeManager: IThemeManager | null;
    defaultDirectory: string;
    chatFileExtension: string;
    getChatNames: () => Promise<{ [name: string]: string }>;
    onChatsChanged?: (cb: () => void) => void;

    // Callback functions instead of command strings
    openChat: (path: string) => void;
    createChat: () => void;
    closeChat: (path: string) => void;
    moveToMain: (path: string) => void;
    renameChat: (
      section: ChatSection.IOptions,
      path: string,
      newName: string
    ) => void;

    chatCommandRegistry?: IChatCommandRegistry;
    attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
    inputToolbarFactory?: IInputToolbarRegistryFactory;
    messageFooterRegistry?: IMessageFooterRegistry;
    welcomeMessage?: string;
  }

  export interface IInputToolbarRegistryFactory {
    create(): IInputToolbarRegistry;
  }
}

/**
 * The chat section containing a chat widget.
 */
class ChatSection extends PanelWithToolbar {
  /**
   * Constructor of the chat section.
   */
  constructor(options: ChatSection.IOptions) {
    super(options);
    this.addWidget(options.widget);
    this.addWidget(this._spinner);
    this.addClass(SECTION_CLASS);
    this._defaultDirectory = options.defaultDirectory;
    this._path = options.path;
    this._closeChat = options.closeChat;
    this._renameChat = options.renameChat;
    this.toolbar.addClass(TOOLBAR_CLASS);
    this._displayName = this._path.replace(/\.chat$/, '');
    this._updateTitle();

    this._markAsRead = new ToolbarButton({
      icon: readIcon,
      iconLabel: 'Mark chat as read',
      className: 'jp-mod-styled',
      onClick: () => (this.model.unreadMessages = [])
    });

    const renameButton = new ToolbarButton({
      iconClass: 'jp-EditIcon',
      iconLabel: 'Rename chat',
      className: 'jp-mod-styled',
      onClick: async () => {
        const newName = await showRenameDialog(this.title.label);
        if (newName && newName.trim() && newName !== this.title.label) {
          this._renameChat(this, this._path, newName.trim());
        }
      }
    });

    const moveToMain = new ToolbarButton({
      icon: launchIcon,
      iconLabel: 'Move the chat to the main area',
      className: 'jp-mod-styled',
      onClick: () => {
        const mainWidget = options.openChat(this._path) as Widget | undefined;

        if (mainWidget) {
          mainWidget.disposed.connect(() => {
            this.dispose();
          });
        }
      }
    });

    const closeButton = new ToolbarButton({
      icon: closeIcon,
      iconLabel: 'Close the chat',
      className: 'jp-mod-styled',
      onClick: () => {
        this.model.dispose();
        this._closeChat(this._path);
        this.dispose();
      }
    });

    this.toolbar.addItem('markRead', this._markAsRead);
    this.toolbar.addItem('rename', renameButton);
    this.toolbar.addItem('moveMain', moveToMain);
    this.toolbar.addItem('close', closeButton);

    this.toolbar.node.style.backgroundColor = 'js-toolbar-background';
    this.toolbar.node.style.minHeight = '32px';
    this.toolbar.node.style.display = 'flex';

    this.model.unreadChanged?.connect(this._unreadChanged);
    this._markAsRead.enabled = this.model.unreadMessages.length > 0;

    options.widget.node.style.height = '100%';

    /**
     * Remove the spinner when the chat is ready.
     */
    this.model.ready.then(() => {
      this._spinner.dispose();
    });
  }

  /**
   * The path of the chat.
   */
  get path(): string {
    return this._path;
  }

  /**
   * The default directory of the chat.
   */
  get defaultDirectory(): string {
    return this._defaultDirectory;
  }

  /**
   * Set the default directory property.
   */
  set defaultDirectory(value: string) {
    this._defaultDirectory = value;
    this._updateTitle();
  }

  /**
   * The model of the widget.
   */
  get model(): IChatModel {
    return (this.widgets[0] as ChatWidget).model;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.model.unreadChanged?.disconnect(this._unreadChanged);
    super.dispose();
  }

  /**
   * Update the section's title, depending on the default directory and chat file name.
   * If the chat file is in the default directory, the section's name is its relative
   * path to that default directory. Otherwise, it is it absolute path.
   */
  private _updateTitle(): void {
    this.title.label = this._displayName;
    this.title.caption = this._path;
  }

  public updateDisplayName(newName: string) {
    this._path = PathExt.join(this.defaultDirectory, `${newName}.chat`);
    this._displayName = newName;
    this._updateTitle();
  }

  public updatePath(newPath: string) {
    this._path = newPath;
    this._updateTitle();
  }

  /**
   * Change the title when messages are unread.
   *
   * TODO: fix it upstream in @jupyterlab/ui-components.
   * Updating the title create a new Title widget, but does not attach again the
   * toolbar. The toolbar is attached only when the title widget is attached the first
   * time.
   */
  private _unreadChanged = (_: IChatModel, unread: number[]) => {
    this._markAsRead.enabled = unread.length > 0;
  };

  private _defaultDirectory: string;
  private _path: string;
  private _markAsRead: ToolbarButton;
  private _spinner = new Spinner();
  private _displayName: string;

  private _closeChat: (path: string) => void;
  private _renameChat: (
    section: ChatSection,
    path: string,
    newName: string
  ) => void;
}

/**
 * The chat section namespace.
 */
export namespace ChatSection {
  /**
   * Options to build a chat section.
   */
  export interface IOptions extends Panel.IOptions {
    widget: ChatWidget;
    path: string;
    defaultDirectory: string;
    openChat: (path: string) => void;
    closeChat: (path: string) => void;
    moveToMain: (path: string) => void;
    renameChat: (section: ChatSection, path: string, newName: string) => void;
  }
}

type ChatSelectProps = {
  chatNamesChanged: ISignal<MultiChatPanel, { [name: string]: string }>;
  handleChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

/**
 * A component to select a chat from the drive.
 */
function ChatSelect({
  chatNamesChanged,
  handleChange
}: ChatSelectProps): JSX.Element {
  // An object associating a chat name to its path. Both are purely indicative, the name
  // is the section title and the path is used as caption.
  const [chatNames, setChatNames] = useState<{ [name: string]: string }>({});

  // Update the chat list.
  chatNamesChanged.connect((_, chatNames) => {
    setChatNames(chatNames);
  });

  return (
    <HTMLSelect onChange={handleChange} value="-">
      {Object.keys(chatNames).map(name => (
        <option value={chatNames[name]}>{name}</option>
      ))}
      <option value="-">Open a chat</option>
    </HTMLSelect>
  );
}
