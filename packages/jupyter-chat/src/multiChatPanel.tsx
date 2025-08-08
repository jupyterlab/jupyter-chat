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
import { Contents } from '@jupyterlab/services';
import { IThemeManager } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import {
  addIcon,
  closeIcon,
  CommandToolbarButton,
  HTMLSelect,
  launchIcon,
  PanelWithToolbar,
  ReactWidget,
  SidePanel,
  Spinner,
  ToolbarButton
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { ISignal, Signal } from '@lumino/signaling';
import { AccordionPanel, Panel } from '@lumino/widgets';
import React, { useState } from 'react';

const SIDEPANEL_CLASS = 'jp-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-chat-add';
const OPEN_SELECT_CLASS = 'jp-chat-open';
const SECTION_CLASS = 'jp-chat-section';
const TOOLBAR_CLASS = 'jp-chat-toolbar';

/**
 * Generic sidepanel widget including multiple chats and the add chat button.
 */
export class MultiChatPanel extends SidePanel {
  /**
   * The constructor of the chat panel.
   */
  constructor(options: ChatPanel.IOptions) {
    super(options);
    this.addClass(SIDEPANEL_CLASS);
    this._commands = options.commands;
    this._contentsManager = options.contentsManager;
    this._rmRegistry = options.rmRegistry;
    this._themeManager = options.themeManager;
    this._defaultDirectory = options.defaultDirectory;
    this._chatFileExtension = options.chatFileExtension;
    this._createChatCommand = options.createChatCommand;
    this._openChatCommand = options.openChatCommand;
    this._chatCommandRegistry = options.chatCommandRegistry;
    this._attachmentOpenerRegistry = options.attachmentOpenerRegistry;
    this._inputToolbarFactory = options.inputToolbarFactory;
    this._messageFooterRegistry = options.messageFooterRegistry;
    this._welcomeMessage = options.welcomeMessage;

    const addChat = new CommandToolbarButton({
      commands: this._commands,
      id: this._createChatCommand,
      args: { inSidePanel: true },
      icon: addIcon
    });
    addChat.addClass(ADD_BUTTON_CLASS);
    this.toolbar.addItem('createChat', addChat);

    this._openChat = ReactWidget.create(
      <ChatSelect
        chatNamesChanged={this._chatNamesChanged}
        handleChange={this._chatSelected.bind(this)}
      />
    );
    this._openChat.addClass(OPEN_SELECT_CLASS);
    this.toolbar.addItem('openChat', this._openChat);

    const content = this.content as AccordionPanel;
    content.expansionToggled.connect(this._onExpansionToggled, this);

    this._contentsManager.fileChanged.connect((_, args) => {
      if (args.type === 'delete') {
        this.widgets.forEach(widget => {
          if ((widget as ChatSection).path === args.oldValue?.path) {
            widget.dispose();
          }
        });
        this.updateChatList();
      }
      const updateActions = ['new', 'rename'];
      if (
        updateActions.includes(args.type) &&
        args.newValue?.path?.endsWith(this._chatFileExtension)
      ) {
        this.updateChatList();
      }
    });
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

    this.addWidget(
      new ChatSection({
        widget,
        commands: this._commands,
        path: model.name,
        defaultDirectory: this._defaultDirectory,
        openChatCommand: this._openChatCommand
      })
    );

    return widget;
  }

  /**
   * Update the list of available chats in the default directory.
   */
  updateChatList = async (): Promise<void> => {
    const extension = this._chatFileExtension;
    this._contentsManager
      .get(this._defaultDirectory)
      .then((contentModel: Contents.IModel) => {
        const chatsNames: { [name: string]: string } = {};
        (contentModel.content as any[])
          .filter(f => f.type === 'file' && f.name.endsWith(extension))
          .forEach(f => {
            chatsNames[PathExt.basename(f.name, extension)] = f.path;
          });
        this._chatNamesChanged.emit(chatsNames);
      })
      .catch(e => console.error('Error getting chat files from drive', e));
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
    this._openChat.renderPromise?.then(() => this.updateChatList());
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
  private _chatSelected = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    const select = event.target;
    const path = select.value;
    const name = select.options[select.selectedIndex].textContent;
    if (name === '-') {
      return;
    }
    this._commands.execute(this._openChatCommand, {
      filepath: path,
      inSidePanel: true
    });
    event.target.selectedIndex = 0;
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
  private _commands: CommandRegistry;
  private _defaultDirectory: string;
  private _chatFileExtension: string;
  private _createChatCommand: string;
  private _openChatCommand: string;
  private _contentsManager: Contents.IManager;
  private _openChat: ReactWidget;
  private _rmRegistry: IRenderMimeRegistry;
  private _themeManager: IThemeManager | null;
  private _chatCommandRegistry?: IChatCommandRegistry;
  private _attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
  private _inputToolbarFactory?: ChatPanel.IInputToolbarRegistryFactory;
  private _messageFooterRegistry?: IMessageFooterRegistry;
  private _welcomeMessage?: string;
}

/**
 * The chat panel namespace.
 */
export namespace ChatPanel {
  /**
   * Options of the constructor of the chat panel.
   */
  export interface IOptions extends SidePanel.IOptions {
    commands: CommandRegistry;
    contentsManager: Contents.IManager;
    rmRegistry: IRenderMimeRegistry;
    themeManager: IThemeManager | null;
    defaultDirectory: string;
    chatFileExtension: string;
    createChatCommand: string;
    openChatCommand: string;
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
    this._openChatCommand = options.openChatCommand;
    this._updateTitle();
    this.toolbar.addClass(TOOLBAR_CLASS);

    this._markAsRead = new ToolbarButton({
      icon: readIcon,
      iconLabel: 'Mark chat as read',
      className: 'jp-mod-styled',
      onClick: () => (this.model.unreadMessages = [])
    });

    const moveToMain = new ToolbarButton({
      icon: launchIcon,
      iconLabel: 'Move the chat to the main area',
      className: 'jp-mod-styled',
      onClick: () => {
        this.model.dispose();
        options.commands.execute(this._openChatCommand, {
          filepath: this._path
        });
        this.dispose();
      }
    });

    const closeButton = new ToolbarButton({
      icon: closeIcon,
      iconLabel: 'Close the chat',
      className: 'jp-mod-styled',
      onClick: () => {
        this.model.dispose();
        this.dispose();
      }
    });

    this.toolbar.addItem('markRead', this._markAsRead);
    this.toolbar.addItem('moveMain', moveToMain);
    this.toolbar.addItem('close', closeButton);

    this.model.unreadChanged?.connect(this._unreadChanged);
    this._markAsRead.enabled = this.model.unreadMessages.length > 0;

    options.widget.node.style.height = '100%';
    /**
     * Remove the spinner when the chat is ready.
     */
    (this.model as any).ready?.then?.(() => {
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
    const inDefault = this._defaultDirectory
      ? !PathExt.relative(this._defaultDirectory, this._path).startsWith('..')
      : true;
    const pattern = new RegExp(`${this._path.split('.').pop()}$`, 'g');
    this.title.label = (
      inDefault
        ? this._defaultDirectory
          ? PathExt.relative(this._defaultDirectory, this._path)
          : this._path
        : '/' + this._path
    ).replace(pattern, '');
    this.title.caption = this._path;
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
  private _markAsRead: ToolbarButton;
  private _path: string;
  private _openChatCommand: string;
  private _spinner = new Spinner();
}

/**
 * The chat section namespace.
 */
export namespace ChatSection {
  /**
   * Options to build a chat section.
   */
  export interface IOptions extends Panel.IOptions {
    commands: CommandRegistry;
    defaultDirectory: string;
    widget: ChatWidget;
    path: string;
    openChatCommand: string;
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
  chatNamesChanged.connect((_, names) => setChatNames(names));
  return (
    <HTMLSelect onChange={handleChange}>
      <option value="-">Open a chat</option>
      {Object.keys(chatNames).map(name => (
        <option key={name} value={chatNames[name]}>
          {name}
        </option>
      ))}
    </HTMLSelect>
  );
}
