/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatWidget,
  IAutocompletionRegistry,
  IChatModel,
  IConfig,
  readIcon
} from '@jupyter/chat';
import { ICollaborativeDrive } from '@jupyter/docprovider';
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

import { CollaborativeChatModel } from './model';
import { CommandIDs, chatFileType } from './token';

const MAIN_PANEL_CLASS = 'jp-collab-chat-main-panel';
const TITLE_UNREAD_CLASS = 'jp-collab-chat-title-unread';
const SIDEPANEL_CLASS = 'jp-collab-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-collab-chat-add';
const OPEN_SELECT_CLASS = 'jp-collab-chat-open';
const SECTION_CLASS = 'jp-collab-chat-section';
const TOOLBAR_CLASS = 'jp-collab-chat-toolbar';

/**
 * DocumentWidget: widget that represents the view or editor for a file type.
 */
export class CollaborativeChatPanel extends DocumentWidget<
  ChatWidget,
  CollaborativeChatModel
> {
  constructor(
    options: DocumentWidget.IOptions<ChatWidget, CollaborativeChatModel>
  ) {
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
  get model(): CollaborativeChatModel {
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
    this._autocompletionRegistry = options.autocompletionRegistry;

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
   * Getter and setter of the config, propagated to all the chat widgets.
   */
  get config(): IConfig {
    return this._config;
  }
  set config(value: Partial<IConfig>) {
    this._config = { ...this._config, ...value };
    this.widgets.forEach(w => {
      (w as ChatSection).model.config = value;
    });
  }

  /**
   * Add a new widget to the chat panel.
   *
   * @param model - the model of the chat widget
   * @param name - the name of the chat.
   */
  addChat(model: IChatModel, name: string, path: string): void {
    // Collapse all chats
    const content = this.content as AccordionPanel;
    for (let i = 0; i < this.widgets.length; i++) {
      content.collapse(i);
    }

    // Set the id of the model.
    model.name = name;

    // Create a new widget.
    const widget = new ChatWidget({
      model: model,
      rmRegistry: this._rmRegistry,
      themeManager: this._themeManager,
      autocompletionRegistry: this._autocompletionRegistry
    });
    this.addWidget(
      new ChatSection({ name, widget, commands: this._commands, path })
    );
  }

  /**
   * Update the list of available chats in the root directory of the drive.
   */
  updateChatNames = async (): Promise<void> => {
    const extension = chatFileType.extensions[0];
    this._drive
      .get('.')
      .then(contentModel => {
        const chatsNames: { [name: string]: string } = {};
        (contentModel.content as any[])
          .filter(f => f.type === 'file' && f.name.endsWith(extension))
          .forEach(
            f => (chatsNames[PathExt.basename(f.name, extension)] = f.name)
          );

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
    this._openChat.renderPromise?.then(() => this.updateChatNames());
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
  private _config: IConfig = {};
  private _drive: ICollaborativeDrive;
  private _openChat: ReactWidget;
  private _rmRegistry: IRenderMimeRegistry;
  private _themeManager: IThemeManager | null;
  private _autocompletionRegistry?: IAutocompletionRegistry;
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
    autocompletionRegistry?: IAutocompletionRegistry;
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
    this.addClass(SECTION_CLASS);
    this._name = options.name;
    this._path = options.path;
    this.title.label = this._name;
    this.title.caption = this._path;
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
          filepath: `${this._name}${chatFileType.extensions[0]}`
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

    this.toolbar.addItem('collaborativeChat-markRead', this._markAsRead);
    this.toolbar.addItem('collaborativeChat-moveMain', moveToMain);
    this.toolbar.addItem('collaborativeChat-close', closeButton);

    this.addWidget(options.widget);

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
   * The name of the chat.
   */
  get name(): string {
    return this._name;
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

  private _name: string;
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
    name: string;
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
