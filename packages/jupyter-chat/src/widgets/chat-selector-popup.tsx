/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Button } from '@jupyter/react-components';
import { closeIcon, ReactWidget } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import React, { useEffect, useRef } from 'react';

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
    this._anchor = options.anchor ?? null;

    // Start hidden
    this.hide();

    // Initialize filtered entries
    this._updateFilteredEntries();
  }

  /**
   * Getter/setter of the anchor element.
   */
  get anchor(): HTMLElement | null {
    return this._anchor;
  }
  set anchor(element: HTMLElement | null) {
    this._anchor = element;
  }

  /**
   * Update the list of available chats.
   */
  updateChats(chatNames: { [name: string]: string }): void {
    this._chatNames = chatNames;
    this._updateFilteredEntries();
    this.update();
  }

  /**
   * Update the list of loaded models.
   */
  setLoadedModels(loadedModels: string[]): void {
    this._loadedModels = new Set(loadedModels);
    this._updateFilteredEntries();
    this.update();
  }

  /**
   * Set the currently displayed chat.
   */
  setCurrentChat(chatName: string | null): void {
    this._currentChat = chatName;
    this.update();
  }

  /**
   * Set the search query and filter the list.
   */
  setQuery(query: string): void {
    this._query = query;
    this._updateFilteredEntries();
    // When filtering, select first in filtered list
    if (query.trim()) {
      this._selectedName =
        this._filteredEntries.length > 0 ? this._filteredEntries[0][0] : null;
    }
    this.update();
  }

  /**
   * Get the currently selected chat value.
   */
  getSelectedValue(): string | null {
    return this._selectedName;
  }

  /**
   * Move selection down.
   */
  selectNext(): void {
    if (this._filteredEntries.length === 0) {
      return;
    }

    const currentIndex = this._filteredEntries.findIndex(
      ([name]) => name === this._selectedName
    );

    // If not found or at the end, wrap to first or move down
    if (currentIndex === -1) {
      // No selection yet, select first
      this._selectedName = this._filteredEntries[0][0];
    } else if (currentIndex < this._filteredEntries.length - 1) {
      // Move to next
      this._selectedName = this._filteredEntries[currentIndex + 1][0];
    }
    this.update();
  }

  /**
   * Move selection up.
   */
  selectPrevious(): void {
    if (this._filteredEntries.length === 0) {
      return;
    }

    const currentIndex = this._filteredEntries.findIndex(
      ([name]) => name === this._selectedName
    );

    // If not found, select last; otherwise move up
    if (currentIndex === -1) {
      // No selection yet, select last
      this._selectedName =
        this._filteredEntries[this._filteredEntries.length - 1][0];
    } else if (currentIndex > 0) {
      // Move to previous
      this._selectedName = this._filteredEntries[currentIndex - 1][0];
    }
    this.update();
  }

  /**
   * Select the current item.
   */
  selectCurrent(): void {
    if (this._selectedName && this._onSelect) {
      this._onSelect(this._selectedName);
    }
  }

  /**
   * Show the popup and position it.
   */
  show(): void {
    // Initialize selection based on current chat or first entry
    const entries = this._filteredEntries;
    let needsUpdate = false;

    if (entries.length > 0) {
      const oldSelection = this._selectedName;
      // If there's a current chat and no query, select it
      if (this._currentChat && !this._query.trim()) {
        this._selectedName = this._currentChat;
      } else if (!this._selectedName) {
        // Otherwise select first entry if nothing is selected
        this._selectedName = entries[0][0];
      }
      needsUpdate = oldSelection !== this._selectedName;
    }

    super.show();
    this._positionPopup();

    // Only update if selection changed
    if (needsUpdate) {
      this.update();
    }
  }

  /**
   * Hide the popup.
   */
  hide(): void {
    this._anchorRect = null;
    super.hide();
  }

  render(): JSX.Element {
    return (
      <ChatSelectorList
        entries={this._filteredEntries}
        selectedName={this._selectedName}
        loadedModels={this._loadedModels}
        onSelect={this._handleItemClick.bind(this)}
        onUpdateSelectedName={this._handleUpdateSelectedName.bind(this)}
        onClose={this._handleClose.bind(this)}
      />
    );
  }

  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
    document.addEventListener(
      'pointerdown',
      this._handleOutsideClick.bind(this),
      true
    );
    window.addEventListener('resize', this._checkPosition);
  }

  protected onAfterHide(msg: Message): void {
    document.removeEventListener(
      'pointerdown',
      this._handleOutsideClick.bind(this),
      true
    );
    window.removeEventListener('resize', this._checkPosition);
    super.onAfterHide(msg);
  }

  /**
   * Check if the popup should move (anchor has moved).
   */
  private _checkPosition = (): void => {
    if (!this._anchor) {
      return;
    }
    console.log('Check position');
    const rect = this._anchor.getBoundingClientRect();
    if (
      rect.bottom !== this._anchorRect?.bottom ||
      rect.left !== this._anchorRect.left ||
      rect.width !== this._anchorRect.width
    ) {
      this._positionPopup();
    }
  };

  /**
   * Position the popup below the search element.
   */
  private _positionPopup(): void {
    if (!this._anchor) {
      return;
    }

    this._anchorRect = this._anchor.getBoundingClientRect();

    const rect = this.node.getBoundingClientRect();
    const margin = 8;

    let left = this._anchorRect.left;
    if (this._anchorRect.left + rect.width > window.innerWidth - margin) {
      left = window.innerWidth - margin - rect.width;
    }

    let top = this._anchorRect.bottom;
    if (this._anchorRect.bottom + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - margin - rect.height;
    }

    this.node.style.minWidth = `${this._anchorRect.width}px`;
    this.node.style.top = `${top}px`;
    this.node.style.left = `${left}px`;
  }

  /**
   * Update the filtered and sorted entries based on current state.
   */
  private _updateFilteredEntries(): void {
    let allEntries = Object.entries(this._chatNames);

    // Filter by query if present
    if (this._query.trim()) {
      const queryLower = this._query.toLowerCase();
      allEntries = allEntries.filter(([_, value]) =>
        value.toLowerCase().includes(queryLower)
      );
    }

    // Separate into loaded and non-loaded
    const loadedEntries: Array<[string, string]> = [];
    const nonLoadedEntries: Array<[string, string]> = [];

    allEntries.forEach(entry => {
      if (this._loadedModels.has(entry[0])) {
        loadedEntries.push(entry);
      } else {
        nonLoadedEntries.push(entry);
      }
    });

    // Sort each group alphabetically by display name
    loadedEntries.sort((a, b) => a[1].localeCompare(b[1]));
    nonLoadedEntries.sort((a, b) => a[1].localeCompare(b[1]));

    // Combine: loaded first, then non-loaded
    this._filteredEntries = [...loadedEntries, ...nonLoadedEntries];
  }

  private _handleItemClick(chatPath: string): void {
    if (this._onSelect) {
      this._onSelect(chatPath);
    }
  }

  private _handleUpdateSelectedName(name: string): void {
    this._selectedName = name;
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
      this._anchor &&
      !this._anchor.contains(target)
    ) {
      this.hide();
    }
  }

  private _chatNames: { [name: string]: string } = {};
  private _loadedModels: Set<string> = new Set();
  private _currentChat: string | null = null;
  private _query: string = '';
  private _selectedName: string | null = null;
  private _filteredEntries: Array<[string, string]> = [];
  private _onSelect?: (value: string) => void;
  private _onClose?: (name: string) => void;
  private _anchor: HTMLElement | null = null;
  private _anchorRect: DOMRect | null = null;
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
    anchor?: HTMLElement;
  }
}

/**
 * Props for the ChatSelectorList component.
 */
interface IChatSelectorListProps {
  entries: Array<[string, string]>;
  selectedName: string | null;
  loadedModels: Set<string>;
  onSelect: (chatPath: string) => void;
  onUpdateSelectedName: (name: string) => void;
  onClose: (chatPath: string) => void;
}

/**
 * React component for rendering the chat list.
 */
function ChatSelectorList({
  entries,
  selectedName,
  loadedModels,
  onSelect,
  onUpdateSelectedName,
  onClose
}: IChatSelectorListProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedName) {
      const selectedItem = listRef.current.querySelector(
        `[data-chat-name="${CSS.escape(selectedName)}"]`
      );
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedName]);

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
      {entries.map(([name, value]) => {
        const isLoaded = loadedModels.has(name);
        return (
          <li
            key={name}
            data-chat-name={name}
            className={`${POPUP_ITEM_CLASS} ${
              name === selectedName ? POPUP_ITEM_ACTIVE_CLASS : ''
            } ${isLoaded ? 'jp-chat-selector-popup-item-loaded' : ''}`}
            onClick={() => onSelect(name)}
            onMouseEnter={() => onUpdateSelectedName(name)}
          >
            <div className="jp-chat-selector-popup-item-content">
              <div className="jp-chat-selector-popup-item-text">
                <div className={POPUP_ITEM_LABEL_CLASS}>
                  <span
                    className="jp-chat-selector-popup-item-name"
                    title={value}
                  >
                    {value}
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
                  onClick={e => handleCloseClick(e, name)}
                  appearance="stealth"
                  title="Close and dispose this chat"
                  className="jp-chat-selector-popup-item-close"
                >
                  <closeIcon.react tag={null} />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
