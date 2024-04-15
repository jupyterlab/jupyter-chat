/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatWidget, IChatModel, IConfig } from '@jupyter/chat';
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
  PanelWithToolbar,
  ReactWidget,
  SidePanel,
  ToolbarButton
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { AccordionPanel, Panel } from '@lumino/widgets';
import React, { useState } from 'react';

import { CollaborativeChatModel } from './model';
import { CommandIDs } from './token';
import { ISignal, Signal } from '@lumino/signaling';
import { Message } from '@lumino/messaging';

const MAIN_PANEL_CLASS = 'jp-collab-chat_main-panel';
const SIDEPANEL_CLASS = 'jp-collab-chat-sidepanel';
const ADD_BUTTON_CLASS = 'jp-collab-chat-add';
const OPEN_SELECT_CLASS = 'jp-collab-chat-open';
const SECTION_CLASS = 'jp-collab-chat-section';
const TOOLBAR_CLASS = 'jp-collab-chat-toolbar';

/**
 * DocumentWidget: widget that represents the view or editor for a file type.
 */
export class CollaborativeChatWidget extends DocumentWidget<
  ChatWidget,
  CollaborativeChatModel
> {
  constructor(
    options: DocumentWidget.IOptions<ChatWidget, CollaborativeChatModel>
  ) {
    super(options);
    this.addClass(MAIN_PANEL_CLASS);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.content.dispose();
    super.dispose();
  }

  /**
   * The model for the widget.
   */
  get model(): CollaborativeChatModel | null {
    return this.content.model as CollaborativeChatModel;
  }
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
  addChat(model: IChatModel, name: string): void {
    // Collapse all chats
    const content = this.content as AccordionPanel;
    for (let i = 0; i < this.widgets.length; i++) {
      content.collapse(i);
    }

    // Create a new widget.
    const widget = new ChatWidget({
      model: model,
      rmRegistry: this._rmRegistry,
      themeManager: this._themeManager
    });
    this.addWidget(new ChatSection({ widget, name }));
  }

  updateChatNames = async (): Promise<void> => {
    this._drive
      .get('.')
      .then(model => {
        const chatsName = (model.content as any[])
          .filter(f => f.type === 'file' && f.name.endsWith('.chat'))
          .map(f => PathExt.basename(f.name, '.chat'));
        this._chatNamesChanged.emit(chatsName);
      })
      .catch(e => console.error('Error getting the chat files from drive', e));
  };

  /**
   * A message handler invoked on an `'after-show'` message.
   */
  protected onAfterShow(msg: Message): void {
    // Wait for the component to be rendered.
    this._openChat.renderPromise?.then(() => this.updateChatNames());
  }

  /**
   * Handle `change` events for the HTMLSelect component.
   */
  private _chatSelected = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    const value = event.target.value;
    if (value === '-') {
      return;
    }

    const index = this.widgets.findIndex(
      w => (w as ChatSection).name === value
    );
    if (index === -1) {
      this._commands.execute(CommandIDs.openChat, {
        filepath: `${value}.chat`,
        inSidePanel: true
      });
    } else if (!this.widgets[index].isVisible) {
      (this.content as AccordionPanel).expand(index);
    }
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

  private _chatNamesChanged = new Signal<this, string[]>(this);
  private _commands: CommandRegistry;
  private _config: IConfig = {};
  private _drive: ICollaborativeDrive;
  private _openChat: ReactWidget;
  private _rmRegistry: IRenderMimeRegistry;
  private _themeManager: IThemeManager | null;
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
    this.title.label = this._name;
    this.title.caption = this._name;
    this.toolbar.addClass(TOOLBAR_CLASS);

    const closeButton = new ToolbarButton({
      icon: closeIcon,
      className: 'jp-mod-styled',
      onClick: () => {
        this.model.dispose();
        this.dispose();
      }
    });
    this.toolbar.addItem('collaborativeChat-close', closeButton);

    this.addWidget(options.widget);
    options.widget.node.style.height = '100%';
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

  private _name: string;
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
    name: string;
  }
}

type ChatSelectProps = {
  chatNamesChanged: ISignal<ChatPanel, string[]>;
  handleChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

/**
 * A component to select a chat from the drive.
 */
function ChatSelect({
  chatNamesChanged,
  handleChange
}: ChatSelectProps): JSX.Element {
  const [chatNames, setChatNames] = useState<string[]>([]);

  // Update the chat list.
  chatNamesChanged.connect((_, chatNames) => {
    setChatNames(chatNames);
  });

  return (
    <HTMLSelect onChange={handleChange}>
      <option value="-">Open a chat</option>
      {chatNames.map(name => (
        <option value={name}>{name}</option>
      ))}
    </HTMLSelect>
  );
}
