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
} from '../index';
import { InputDialog, IThemeManager } from '@jupyterlab/apputils';
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
import { AccordionPanel, Panel } from '@lumino/widgets';
import React, { useState } from 'react';

const SIDEPANEL_CLASS = 'jp-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-chat-add';
const OPEN_SELECT_CLASS = 'jp-chat-open';
const SECTION_CLASS = 'jp-chat-section';
const TOOLBAR_CLASS = 'jp-chat-section-toolbar';

/**
 * Generic sidepanel widget including multiple chats and the add chat button.
 */
export class MultiChatPanel extends SidePanel {
  constructor(options: ChatPanel.IOptions) {
    super(options);
    this.addClass(SIDEPANEL_CLASS);

    this._rmRegistry = options.rmRegistry;
    this._themeManager = options.themeManager;
    this._chatCommandRegistry = options.chatCommandRegistry;
    this._attachmentOpenerRegistry = options.attachmentOpenerRegistry;
    this._inputToolbarFactory = options.inputToolbarFactory;
    this._messageFooterRegistry = options.messageFooterRegistry;
    this._welcomeMessage = options.welcomeMessage;
    this._getChatNames = options.getChatNames;

    // Use the passed callback functions
    this._openChat = options.openChat;
    this._openInMain = options.openInMain;
    this._createChat = options.createChat ?? (() => {});
    this._renameChat = options.renameChat;

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
      openInMain: this._openInMain,
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
  openIfExists(name: string): boolean {
    const index = this._getChatIndex(name);
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
  private _getChatIndex(name: string) {
    return this.widgets.findIndex(w => (w as ChatSection).model?.name === name);
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
   * Triggered when a section is toggled. If the section is opened, all others
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

  private _rmRegistry: IRenderMimeRegistry;
  private _themeManager: IThemeManager | null;
  private _chatCommandRegistry?: IChatCommandRegistry;
  private _attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
  private _inputToolbarFactory?: ChatPanel.IInputToolbarRegistryFactory;
  private _messageFooterRegistry?: IMessageFooterRegistry;
  private _welcomeMessage?: string;
  private _getChatNames: () => Promise<{ [name: string]: string }>;

  private _createChat: () => void;
  private _openChat: (name: string) => void;
  private _openInMain?: (name: string) => void;
  private _renameChat?: (oldName: string, newName: string) => Promise<boolean>;

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
    getChatNames: () => Promise<{ [name: string]: string }>;

    // Callback functions instead of command strings
    openChat: (name: string) => void;
    createChat: () => void;
    openInMain?: (name: string) => void;
    renameChat?: (oldName: string, newName: string) => Promise<boolean>;

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
    this.toolbar.addClass(TOOLBAR_CLASS);
    this._displayName = options.widget.model.name ?? 'Chat';
    this._updateTitle();

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
            return; // user cancelled
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
        onClick: () => {
          const name = this.model.name;
          this.model.dispose();
          options.openInMain?.(name);
          this.dispose();
        }
      });
      this.toolbar.addItem('moveMain', moveToMain);
    }

    const closeButton = new ToolbarButton({
      icon: closeIcon,
      iconLabel: 'Close the chat',
      className: 'jp-mod-styled',
      onClick: () => {
        this.model.dispose();
        this.dispose();
      }
    });

    this.toolbar.addItem('close', closeButton);

    this.model.unreadChanged?.connect(this._unreadChanged);
    this._markAsRead.enabled = (this.model?.unreadMessages.length ?? 0) > 0;

    options.widget.node.style.height = '100%';

    /**
     * Remove the spinner when the chat is ready.
     */
    this.model.ready.then(() => {
      this._spinner.dispose();
    });
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
    const model = this.model;
    if (model) {
      model.unreadChanged?.disconnect(this._unreadChanged);
    }
    super.dispose();
  }

  /**
   *  * Update the section’s title based on the chat name.
   * */

  private _updateTitle(): void {
    this.title.label = this._displayName;
    this.title.caption = this._displayName;
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

  private _markAsRead: ToolbarButton;
  private _spinner = new Spinner();
  private _displayName: string;
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
    openInMain?: (name: string) => void;
    renameChat?: (oldName: string, newName: string) => Promise<boolean>;
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
      <option value="-">Open a chat</option>
      {Object.keys(chatNames).map(name => (
        <option value={chatNames[name]}>{name}</option>
      ))}
    </HTMLSelect>
  );
}
