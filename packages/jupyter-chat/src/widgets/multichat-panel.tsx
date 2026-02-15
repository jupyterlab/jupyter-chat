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
  HTMLSelect,
  launchIcon,
  PanelWithToolbar,
  ReactWidget,
  SidePanel,
  Spinner,
  ToolbarButton
} from '@jupyterlab/ui-components';
import { Debouncer } from '@lumino/polling';
import { ISignal, Signal } from '@lumino/signaling';
import { AccordionPanel, Panel } from '@lumino/widgets';
import React, { useState } from 'react';

import { ChatWidget } from './chat-widget';
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
const SECTION_CLASS = 'jp-chat-section';
const TOOLBAR_CLASS = 'jp-chat-section-toolbar';

/**
 * Generic sidepanel widget including multiple chats and the add chat button.
 */
export class MultiChatPanel extends SidePanel {
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
          this.addChat(addChatArgs);
        },
        icon: addIcon,
        label: 'Chat',
        tooltip: 'Add a new chat'
      });
      addChat.addClass(ADD_BUTTON_CLASS);
      this.toolbar.addItem('createChat', addChat);
    }

    if (this._getChatNames && this._createModel) {
      // Chat select dropdown
      this._openChatWidget = ReactWidget.create(
        <ChatSelect
          chatNamesChanged={this._chatNamesChanged}
          handleChange={this._chatSelected.bind(this)}
        />
      );
      this._openChatWidget.addClass(OPEN_SELECT_CLASS);
      this.toolbar.addItem('openChat', this._openChatWidget);
    }

    const content = this.content as AccordionPanel;
    content.expansionToggled.connect(this._onExpansionToggled, this);

    this._updateChatListDebouncer = new Debouncer(this._updateChatList, 200);
  }

  /**
   * The sections of the side panel.
   */
  get sections(): ChatSection[] {
    return this.widgets as ChatSection[];
  }

  /**
   * A signal emitting when a section is added to the panel.
   */
  get sectionAdded(): ISignal<MultiChatPanel, ChatSection> {
    return this._sectionAdded;
  }

  /**
   * Add a new widget to the chat panel.
   *
   * @param model - the model of the chat widget
   * @param displayName - the name of the chat.
   */

  addChat(args: MultiChatPanel.IAddChatArgs): ChatWidget | undefined {
    const { model, displayName } = args;
    if (!model) {
      return;
    }

    if (this.openIfExists(model.name)) {
      return;
    }

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
      ...this._chatOptions,
      inputToolbarRegistry,
      area: 'sidebar'
    });

    const section = new ChatSection({
      widget,
      openInMain: this._openInMain,
      renameChat: this._renameChat,
      displayName
    });

    this.addWidget(section);
    content.expand(this.widgets.length - 1);

    this._sectionAdded.emit(section);
    return widget;
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
      this._chatNamesChanged.emit(chatNames ?? {});
    } catch (e) {
      console.error('Error getting chat files', e);
    }
  };

  /**
   * Open a chat if it exists in the side panel.
   *
   * @param name - the name of the chat.
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
    this._openChatWidget?.renderPromise?.then(() => this.updateChatList());
  }

  /**
   * Return the index of the chat in the list (-1 if not opened).
   *
   * @param name - the chat name.
   */
  private _getChatIndex(name: string) {
    return this.sections.findIndex(section => section.model?.name === name);
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
  private async _chatSelected(
    event: React.ChangeEvent<HTMLSelectElement>
  ): Promise<void> {
    const selection = event.target.value;
    if (selection === '-') {
      return;
    }
    if (this._createModel) {
      const addChatArgs = await this._createModel(selection);
      this.addChat(addChatArgs);
    }
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
  private _sectionAdded = new Signal<MultiChatPanel, ChatSection>(this);
  private _chatOptions: Omit<Chat.IOptions, 'model' | 'inputToolbarRegistry'>;
  private _inputToolbarFactory?: IInputToolbarRegistryFactory;
  private _updateChatListDebouncer: Debouncer;

  private _createModel?: (
    name?: string
  ) => Promise<MultiChatPanel.IAddChatArgs>;
  private _getChatNames?: () => Promise<{ [name: string]: string }>;
  private _openInMain?: (name: string) => Promise<boolean>;
  private _renameChat?: (oldName: string, newName: string) => Promise<boolean>;

  private _openChatWidget?: ReactWidget;
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
    createModel?: (name?: string) => Promise<IAddChatArgs>;
    /**
     * An optional callback to get the list of existing chats.
     *
     * @returns an object with display name as key and the "full" name as value.
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
  export interface IAddChatArgs {
    /**
     * The model of the chat.
     * No-op id undefined.
     */
    model?: IChatModel;
    /**
     * The display name of the chat in the section title.
     */
    displayName?: string;
  }
}

/**
 * The chat section containing a chat widget.
 */
export class ChatSection extends PanelWithToolbar {
  /**
   * Constructor of the chat section.
   */
  constructor(options: ChatSection.IOptions) {
    super(options);
    this._chatWidget = options.widget;
    this.addWidget(this._chatWidget);
    this.addWidget(this._spinner);
    this.addClass(SECTION_CLASS);
    this.toolbar.addClass(TOOLBAR_CLASS);
    this._displayName =
      options.displayName ?? options.widget.model.name ?? 'Chat';
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
   * The display name.
   */
  get displayName(): string {
    return this._displayName;
  }
  set displayName(value: string) {
    this._displayName = value;
    this._updateTitle();
  }

  /**
   * The chat widget of the section.
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

  private _chatWidget: ChatWidget;
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
    /**
     * The widget to display in the section.
     */
    widget: ChatWidget;
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
    /**
     * The name to display in the section title.
     */
    displayName?: string;
  }
}

export type ChatSelectProps = {
  /**
   * A signal emitting when the list of chat changed.
   */
  chatNamesChanged: ISignal<MultiChatPanel, { [name: string]: string }>;
  /**
   * The callback to call when the selection changed in the select.
   */
  handleChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

/**
 * A component to select a chat from the drive.
 */
export function ChatSelect({
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
    <HTMLSelect
      key={Object.keys(chatNames).join()}
      onChange={handleChange}
      value="-"
    >
      <option value="-" disabled hidden>
        Open a chat
      </option>
      {Object.keys(chatNames).map(name => (
        <option value={chatNames[name]}>{name}</option>
      ))}
    </HTMLSelect>
  );
}
