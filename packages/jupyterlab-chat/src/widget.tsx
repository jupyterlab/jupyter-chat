/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatWidget,
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IChatModel,
  IInputToolbarRegistry,
  readIcon
} from '@jupyter/chat';
import { ICollaborativeDrive } from '@jupyter/collaborative-drive';
import { IThemeManager } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { DocumentWidget } from '@jupyterlab/docregistry';
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
  ToolbarButton
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import { AccordionPanel, Panel } from '@lumino/widgets';
import React, { useState } from 'react';

import { LabChatModel } from './model';
import {
  CommandIDs,
  IInputToolbarRegistryFactory,
  chatFileType
} from './token';

const MAIN_PANEL_CLASS = 'jp-lab-chat-main-panel';
const TITLE_UNREAD_CLASS = 'jp-lab-chat-title-unread';
const SIDEPANEL_CLASS = 'jp-lab-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-lab-chat-add';
const OPEN_SELECT_CLASS = 'jp-lab-chat-open';
const SECTION_CLASS = 'jp-lab-chat-section';
const TOOLBAR_CLASS = 'jp-lab-chat-toolbar';

/**
 * DocumentWidget: widget that represents the view or editor for a file type.
 */
export class LabChatPanel extends DocumentWidget<ChatWidget, LabChatModel> {
  constructor(options: DocumentWidget.IOptions<ChatWidget, LabChatModel>) {
    super(options);
    this.addClass(MAIN_PANEL_CLASS);
    this.model.name = this.context.localPath;
    this.model.unreadChanged.connect(this._unreadChanged);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.model.unreadChanged.disconnect(this._unreadChanged);
    this.context.dispose();
    this.content.dispose();
    super.dispose();
  }

  /**
   * The model for the widget.
   */
  get model(): LabChatModel {
    return this.context.model;
  }

  /**
   * Add class to tab when messages are unread.
   */
  private _unreadChanged = (_: IChatModel, unread: number[]) => {
    if (unread.length) {
      if (!this.title.className.includes(TITLE_UNREAD_CLASS)) {
        this.title.className += ` ${TITLE_UNREAD_CLASS}`;
      }
    } else {
      this.title.className = this.title.className.replace(
        TITLE_UNREAD_CLASS,
        ''
      );
    }
  };
}

/**
 * Sidepanel widget including the chats and the add chat button.
 */
export class ChatPanel extends SidePanel {
  /**
   * The constructor of the chat panel.
   */
  constructor(options: ChatPanel.IOptions) {
    super(options);
    this.addClass(SIDEPANEL_CLASS);
    this._commands = options.commands;
    this._drive = options.drive;
    this._rmRegistry = options.rmRegistry;
    this._themeManager = options.themeManager;
    this._defaultDirectory = options.defaultDirectory;
    this._chatCommandRegistry = options.chatCommandRegistry;
    this._attachmentOpenerRegistry = options.attachmentOpenerRegistry;
    this._inputToolbarFactory = options.inputToolbarFactory;

    const addChat = new CommandToolbarButton({
      commands: this._commands,
      id: CommandIDs.createChat,
      args: { inSidePanel: true },
      icon: addIcon
    });
    addChat.addClass(ADD_BUTTON_CLASS);
    this.toolbar.addItem('createChat', addChat);

    this._openChat = ReactWidget.create(
      <ChatSelect
        chatNamesChanged={this._chatNamesChanged}
        handleChange={this._chatSelected.bind(this)}
      ></ChatSelect>
    );

    this._openChat.addClass(OPEN_SELECT_CLASS);
    this.toolbar.addItem('openChat', this._openChat);

    const content = this.content as AccordionPanel;
    content.expansionToggled.connect(this._onExpansionToggled, this);
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
    // Collapse all chats
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
      model: model,
      rmRegistry: this._rmRegistry,
      themeManager: this._themeManager,
      chatCommandRegistry: this._chatCommandRegistry,
      attachmentOpenerRegistry: this._attachmentOpenerRegistry,
      inputToolbarRegistry
    });

    this.addWidget(
      new ChatSection({
        widget,
        commands: this._commands,
        path: model.name,
        defaultDirectory: this._defaultDirectory
      })
    );

    return widget;
  }

  /**
   * Update the list of available chats in the default directory.
   */
  updateChatList = async (): Promise<void> => {
    const extension = chatFileType.extensions[0];
    this._drive
      .get(this._defaultDirectory)
      .then(contentModel => {
        const chatsNames: { [name: string]: string } = {};
        (contentModel.content as any[])
          .filter(f => f.type === 'file' && f.name.endsWith(extension))
          .forEach(f => {
            chatsNames[PathExt.basename(f.name, extension)] = f.path;
          });

        this._chatNamesChanged.emit(chatsNames);
      })
      .catch(e => console.error('Error getting the chat files from drive', e));
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
   * A message handler invoked on an `'after-show'` message.
   */
  protected onAfterShow(msg: Message): void {
    // Wait for the component to be rendered.
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

    this._commands.execute(CommandIDs.openChat, {
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
  private _drive: ICollaborativeDrive;
  private _openChat: ReactWidget;
  private _rmRegistry: IRenderMimeRegistry;
  private _themeManager: IThemeManager | null;
  private _chatCommandRegistry?: IChatCommandRegistry;
  private _attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
  private _inputToolbarFactory?: IInputToolbarRegistryFactory;
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
    drive: ICollaborativeDrive;
    rmRegistry: IRenderMimeRegistry;
    themeManager: IThemeManager | null;
    defaultDirectory: string;
    chatCommandRegistry?: IChatCommandRegistry;
    attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
    inputToolbarFactory?: IInputToolbarRegistryFactory;
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

    this.addClass(SECTION_CLASS);
    this._defaultDirectory = options.defaultDirectory;
    this._path = options.path;
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
        options.commands.execute(CommandIDs.openChat, {
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

    this.toolbar.addItem('jupyterlabChat-markRead', this._markAsRead);
    this.toolbar.addItem('jupyterlabChat-moveMain', moveToMain);
    this.toolbar.addItem('jupyterlabChat-close', closeButton);

    this.model.unreadChanged?.connect(this._unreadChanged);

    this._markAsRead.enabled = this.model.unreadMessages.length > 0;

    options.widget.node.style.height = '100%';
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

    const pattern = new RegExp(`${chatFileType.extensions[0]}$`, 'g');
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
    // this.title.label = `${unread.length ? '* ' : ''}${this._name}`;
  };

  private _defaultDirectory: string;
  private _markAsRead: ToolbarButton;
  private _path: string;
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
  }
}

type ChatSelectProps = {
  chatNamesChanged: ISignal<ChatPanel, { [name: string]: string }>;
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
    <HTMLSelect onChange={handleChange}>
      <option value="-">Open a chat</option>
      {Object.keys(chatNames).map(name => (
        <option value={chatNames[name]}>{name}</option>
      ))}
    </HTMLSelect>
  );
}
