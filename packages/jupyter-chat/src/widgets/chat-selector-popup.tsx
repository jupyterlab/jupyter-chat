/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Button } from '@jupyter/react-components';
import {
  classes,
  closeIcon,
  LabIcon,
  ReactWidget
} from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import React, { useEffect, useRef, useState } from 'react';

const POPUP_CLASS = 'jp-chat-selector-popup';
const POPUP_LIST_CLASS = 'jp-chat-selector-popup-list';
const POPUP_ITEM_CLASS = 'jp-chat-selector-popup-item';
const POPUP_ITEM_ACTIVE_CLASS = 'jp-chat-selector-popup-item-active';
const POPUP_ITEM_LABEL_CLASS = 'jp-chat-selector-popup-item-label';
const POPUP_EMPTY_CLASS = 'jp-chat-selector-popup-empty';

/**
 * A popup widget for selecting a chat from a filtered list.
 */
export class ChatSelectorPopup extends ReactWidget {
  constructor(options: ChatSelectorPopup.IOptions) {
    super();
    this.addClass(POPUP_CLASS);
    this._chatNames = options.chatNames;
    this._onSelect = options.onSelect;
    this._onClose = options.onClose;
    this._anchorElement = options.anchorElement;

    // Start hidden
    this.hide();
  }

  /**
   * Update the list of available chats.
   */
  updateChats(chatNames: { [name: string]: string }): void {
    this._chatNames = chatNames;
    this.update();
  }

  /**
   * Update the list of loaded models.
   */
  setLoadedModels(loadedModels: string[]): void {
    this._loadedModels = new Set(loadedModels);
    this.update();
  }

  /**
   * Set the search query and filter the list.
   */
  setQuery(query: string): void {
    this._query = query;
    this._selectedIndex = 0;
    this.update();
  }

  /**
   * Get the currently selected chat value.
   */
  getSelectedValue(): string | null {
    const entries = this._getFilteredEntries();
    if (this._selectedIndex >= 0 && this._selectedIndex < entries.length) {
      return entries[this._selectedIndex][1];
    }
    return null;
  }

  /**
   * Move selection down.
   */
  selectNext(): void {
    const entries = this._getFilteredEntries();
    if (this._selectedIndex < entries.length - 1) {
      this._selectedIndex++;
      this.update();
    }
  }

  /**
   * Move selection up.
   */
  selectPrevious(): void {
    if (this._selectedIndex > 0) {
      this._selectedIndex--;
      this.update();
    }
  }

  /**
   * Select the current item.
   */
  selectCurrent(): void {
    const value = this.getSelectedValue();
    if (value && this._onSelect) {
      this._onSelect(value);
    }
  }

  /**
   * Position the popup below the anchor element.
   */
  positionBelowAnchor(): void {
    if (!this._anchorElement) {
      return;
    }

    const rect = this._anchorElement.getBoundingClientRect();
    this.node.style.position = 'fixed';
    this.node.style.top = `${rect.bottom}px`;
    this.node.style.left = `${rect.left}px`;
    this.node.style.width = `${Math.max(rect.width, 300)}px`;
  }

  /**
   * Show the popup and position it.
   */
  showPopup(): void {
    this.show();
    this.positionBelowAnchor();
  }

  /**
   * Hide the popup.
   */
  hidePopup(): void {
    this.hide();
  }

  render(): JSX.Element {
    return (
      <ChatSelectorList
        chatNames={this._chatNames}
        query={this._query}
        selectedIndex={this._selectedIndex}
        loadedModels={this._loadedModels}
        onSelect={this._handleItemClick.bind(this)}
        onUpdateSelectedIndex={this._handleUpdateSelectedIndex.bind(this)}
        onClose={this._handleClose.bind(this)}
      />
    );
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    document.addEventListener(
      'click',
      this._handleOutsideClick.bind(this),
      true
    );
  }

  protected onBeforeDetach(msg: Message): void {
    document.removeEventListener(
      'click',
      this._handleOutsideClick.bind(this),
      true
    );
    super.onBeforeDetach(msg);
  }

  private _getFilteredEntries(): Array<[string, string]> {
    const entries = Object.entries(this._chatNames);
    if (!this._query.trim()) {
      return entries;
    }
    const query = this._query.toLowerCase();
    return entries.filter(([name]) => name.toLowerCase().includes(query));
  }

  private _handleItemClick(chatPath: string): void {
    if (this._onSelect) {
      this._onSelect(chatPath);
    }
  }

  private _handleUpdateSelectedIndex(index: number): void {
    this._selectedIndex = index;
  }

  private _handleClose(chatPath: string): void {
    if (this._onClose) {
      this._onClose(chatPath);
    }
  }

  private _handleOutsideClick(event: MouseEvent): void {
    if (this.isHidden) {
      return;
    }

    const target = event.target as HTMLElement;
    if (
      !this.node.contains(target) &&
      this._anchorElement &&
      !this._anchorElement.contains(target)
    ) {
      this.hidePopup();
    }
  }

  private _chatNames: { [name: string]: string } = {};
  private _loadedModels: Set<string> = new Set();
  private _query: string = '';
  private _selectedIndex: number = 0;
  private _onSelect?: (value: string) => void;
  private _onClose?: (name: string) => void;
  private _anchorElement?: HTMLElement;
}

/**
 * Namespace for ChatSelectorPopup.
 */
export namespace ChatSelectorPopup {
  export interface IOptions {
    /**
     * Object mapping display names to values used to identify/open chats.
     */
    chatNames: { [name: string]: string };
    /**
     * Callback when a chat is selected.
     */
    onSelect?: (value: string) => void;
    /**
     * Callback when a chat is closed/disposed.
     */
    onClose?: (name: string) => void;
    /**
     * The element to anchor the popup to.
     */
    anchorElement?: HTMLElement;
  }
}

/**
 * Props for the ChatSelectorList component.
 */
interface IChatSelectorListProps {
  chatNames: { [name: string]: string };
  query: string;
  selectedIndex: number;
  loadedModels: Set<string>;
  onSelect: (chatPath: string) => void;
  onUpdateSelectedIndex: (index: number) => void;
  onClose: (chatPath: string) => void;
}

/**
 * React component for rendering the chat list.
 */
function ChatSelectorList({
  chatNames,
  query,
  selectedIndex,
  loadedModels,
  onSelect,
  onUpdateSelectedIndex,
  onClose
}: IChatSelectorListProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const [entries, setEntries] = useState<Array<[string, string]>>([]);

  // Filter and sort entries based on query, with loaded chats first
  useEffect(() => {
    let allEntries = Object.entries(chatNames);

    // Filter by query if present
    if (query.trim()) {
      const queryLower = query.toLowerCase();
      allEntries = allEntries.filter(([name]) =>
        name.toLowerCase().includes(queryLower)
      );
    }

    // Separate into loaded and non-loaded
    const loadedEntries: Array<[string, string]> = [];
    const nonLoadedEntries: Array<[string, string]> = [];

    allEntries.forEach(entry => {
      if (loadedModels.has(entry[1])) {
        loadedEntries.push(entry);
      } else {
        nonLoadedEntries.push(entry);
      }
    });

    // Sort each group alphabetically by display name
    loadedEntries.sort((a, b) => a[0].localeCompare(b[0]));
    nonLoadedEntries.sort((a, b) => a[0].localeCompare(b[0]));

    // Combine: loaded first, then non-loaded
    setEntries([...loadedEntries, ...nonLoadedEntries]);
  }, [chatNames, query, loadedModels]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll(`.${POPUP_ITEM_CLASS}`);
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleCloseClick = (
    event: React.MouseEvent,
    chatPath: string
  ): void => {
    event.stopPropagation();
    onClose(chatPath);
  };

  if (entries.length === 0) {
    return <div className={POPUP_EMPTY_CLASS}>No chats found</div>;
  }

  return (
    <ul ref={listRef} className={POPUP_LIST_CLASS}>
      {entries.map(([name, value], index) => {
        const isLoaded = loadedModels.has(value);
        return (
          <li
            key={value}
            className={`${POPUP_ITEM_CLASS} ${
              index === selectedIndex ? POPUP_ITEM_ACTIVE_CLASS : ''
            } ${isLoaded ? 'jp-chat-selector-popup-item-loaded' : ''}`}
            onClick={() => onSelect(value)}
            onMouseEnter={() => onUpdateSelectedIndex(index)}
          >
            <div className="jp-chat-selector-popup-item-content">
              <div className="jp-chat-selector-popup-item-text">
                <div className={POPUP_ITEM_LABEL_CLASS}>
                  <span
                    className="jp-chat-selector-popup-item-name"
                    title={name}
                  >
                    {name}
                  </span>
                  {isLoaded && (
                    <span className="jp-chat-selector-popup-item-indicator">
                      ●
                    </span>
                  )}
                </div>
              </div>
              {isLoaded && (
                <Button
                  onClick={e => handleCloseClick(e, value)}
                  appearance="stealth"
                  title="Close and dispose this chat"
                  className="jp-chat-selector-popup-item-close"
                >
                  <LabIcon.resolveReact
                    display={'flex'}
                    icon={closeIcon}
                    iconClass={classes('jp-Icon')}
                  />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
