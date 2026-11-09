/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Button } from '@jupyter/react-components';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { closeIcon, ReactWidget } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import React, { useEffect, useRef } from 'react';

import { TRANSLATION_DOMAIN } from '../context';

const POPUP_CLASS = 'jp-chat-selector-popup';
const POPUP_LIST_CLASS = 'jp-chat-selector-popup-list';
const POPUP_ITEM_CLASS = 'jp-chat-selector-popup-item';
const POPUP_ITEM_ACTIVE_CLASS = 'jp-chat-selector-popup-item-active';
const POPUP_ITEM_LABEL_CLASS = 'jp-chat-selector-popup-item-label';
const POPUP_EMPTY_CLASS = 'jp-chat-selector-popup-empty';
const CHAT_NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true });

/**
 * A popup widget for selecting a chat from a filtered list.
 */
export class ChatSelectorPopup extends ReactWidget {
  constructor(options: ChatSelectorPopup.IOptions) {
    super();
    this.addClass(POPUP_CLASS);
    this._chats = options.chats;
    this._onSelect = options.onSelect;
    this._onClose = options.onClose;
    this._anchor = options.anchor ?? null;
    this._trans = (options.translator ?? nullTranslator).load(
      TRANSLATION_DOMAIN
    );

    // Start hidden
    this.hide();

    // Initialize filtered chats
    this._updateFilteredChats();
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
   *
   * @param chats - an object mapping the chat keys to their display names.
   */
  updateChats(chats: { [key: string]: string }): void {
    this._chats = chats;
    this._updateFilteredChats();
    this.update();
  }

  /**
   * Update the list of loaded chats.
   *
   * @param loadedModels - an object mapping the keys of the loaded chats to
   *   their display names.
   */
  setLoadedModels(loadedModels: { [key: string]: string }): void {
    this._loadedModels = loadedModels;
    this._updateFilteredChats();
    this.update();
  }

  /**
   * Set the currently displayed chat.
   *
   * @param key - the key of the chat, or null if no chat is displayed.
   */
  setCurrentChat(key: string | null): void {
    this._currentChat = key;
    this.update();
  }

  /**
   * Set the search query and filter the list.
   */
  setQuery(query: string): void {
    this._query = query;
    this._updateFilteredChats();
    // When filtering, select first in filtered list
    if (query.trim()) {
      this._selectedKey =
        this._filteredChats.length > 0 ? this._filteredChats[0] : null;
    }
    this.update();
  }

  /**
   * Get the key of the currently selected chat.
   */
  getSelectedValue(): string | null {
    return this._selectedKey;
  }

  /**
   * Move selection down.
   */
  selectNext(): void {
    if (this._filteredChats.length === 0) {
      return;
    }

    const currentIndex = this._filteredChats.findIndex(
      key => key === this._selectedKey
    );

    // If not found or at the end, wrap to first or move down
    if (currentIndex === -1) {
      // No selection yet, select first
      this._selectedKey = this._filteredChats[0];
    } else if (currentIndex < this._filteredChats.length - 1) {
      // Move to next
      this._selectedKey = this._filteredChats[currentIndex + 1];
    }
    this.update();
  }

  /**
   * Move selection up.
   */
  selectPrevious(): void {
    if (this._filteredChats.length === 0) {
      return;
    }

    const currentIndex = this._filteredChats.findIndex(
      key => key === this._selectedKey
    );

    // If not found, select last; otherwise move up
    if (currentIndex === -1) {
      // No selection yet, select last
      this._selectedKey = this._filteredChats[this._filteredChats.length - 1];
    } else if (currentIndex > 0) {
      // Move to previous
      this._selectedKey = this._filteredChats[currentIndex - 1];
    }
    this.update();
  }

  /**
   * Show the popup and position it.
   */
  show(): void {
    let needsUpdate = false;

    if (this._filteredChats.length > 0) {
      const oldSelection = this._selectedKey;
      // If there's a current chat and no query, select it
      if (this._currentChat && !this._query.trim()) {
        this._selectedKey = this._currentChat;
      } else if (!this._selectedKey) {
        // Otherwise select first chat if nothing is selected
        this._selectedKey = this._filteredChats[0];
      }
      needsUpdate = oldSelection !== this._selectedKey;
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
        chats={this._filteredChats.map(key => ({
          key,
          name: this._getName(key)
        }))}
        selectedKey={this._selectedKey}
        loadedModels={new Set(Object.keys(this._loadedModels))}
        onSelect={this._handleItemClick}
        onUpdateSelectedKey={this._handleUpdateSelectedKey}
        onClose={this._handleClose}
        trans={this._trans}
      />
    );
  }

  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
    document.addEventListener('pointerdown', this._handleOutsideClick, true);
    window.addEventListener('resize', this._checkPosition);
  }

  protected onAfterHide(msg: Message): void {
    document.removeEventListener('pointerdown', this._handleOutsideClick, true);
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
   * Update the filtered and sorted chats based on current state.
   */
  private _updateFilteredChats(): void {
    let filteredChats = Array.from(
      new Set([...Object.keys(this._chats), ...Object.keys(this._loadedModels)])
    );

    // Filter by query if present
    if (this._query.trim()) {
      const queryLower = this._query.toLowerCase();
      filteredChats = filteredChats.filter(key =>
        this._getName(key).toLowerCase().includes(queryLower)
      );
    }

    // Separate into loaded and non-loaded
    const loadedChats: string[] = [];
    const nonLoadedChats: string[] = [];

    filteredChats.forEach(key => {
      if (key in this._loadedModels) {
        loadedChats.push(key);
      } else {
        nonLoadedChats.push(key);
      }
    });

    // Sort each group naturally by name
    const compare = (a: string, b: string) =>
      CHAT_NAME_COLLATOR.compare(this._getName(a), this._getName(b));
    loadedChats.sort(compare);
    nonLoadedChats.sort(compare);

    // Combine: loaded first, then non-loaded
    this._filteredChats = [...loadedChats, ...nonLoadedChats];
  }

  /**
   * Get the display name of a chat, the loaded chat name taking precedence.
   */
  private _getName(key: string): string {
    return this._loadedModels[key] ?? this._chats[key] ?? key;
  }

  private _handleItemClick = (key: string): void => {
    if (this._onSelect) {
      this._onSelect(key);
    }
  };

  private _handleUpdateSelectedKey = (key: string): void => {
    this._selectedKey = key;
  };

  private _handleClose = (key: string): void => {
    if (this._onClose) {
      this._onClose(key);
    }
  };

  private _handleOutsideClick = (event: MouseEvent): void => {
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
  };

  private _chats: { [key: string]: string } = {};
  private _loadedModels: { [key: string]: string } = {};
  private _currentChat: string | null = null;
  private _query: string = '';
  private _selectedKey: string | null = null;
  private _filteredChats: string[] = [];
  private _onSelect?: (key: string) => void;
  private _onClose?: (key: string) => void;
  private _anchor: HTMLElement | null = null;
  private _anchorRect: DOMRect | null = null;
  private _trans: TranslationBundle;
}

/**
 * Namespace for ChatSelectorPopup.
 */
export namespace ChatSelectorPopup {
  export interface IOptions {
    /**
     * Object mapping the chat keys to their display names.
     */
    chats: { [key: string]: string };
    /**
     * Callback when a chat is selected, called with the chat key.
     */
    onSelect?: (key: string) => void;
    /**
     * Callback when a chat is closed/disposed, called with the chat key.
     */
    onClose?: (key: string) => void;
    /**
     * The element to anchor the popup to.
     */
    anchor?: HTMLElement;
    /**
     * The translator for internationalization.
     */
    translator?: ITranslator;
  }
}

/**
 * Props for the ChatSelectorList component.
 */
interface IChatSelectorListProps {
  chats: { key: string; name: string }[];
  selectedKey: string | null;
  loadedModels: Set<string>;
  onSelect: (key: string) => void;
  onUpdateSelectedKey: (key: string) => void;
  onClose: (key: string) => void;
  trans: TranslationBundle;
}

/**
 * React component for rendering the chat list.
 */
function ChatSelectorList({
  chats,
  selectedKey,
  loadedModels,
  onSelect,
  onUpdateSelectedKey,
  onClose,
  trans
}: IChatSelectorListProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedKey) {
      const selectedItem = listRef.current.querySelector(
        `[data-chat-key="${CSS.escape(selectedKey)}"]`
      );
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedKey]);

  const handleCloseClick = (event: React.MouseEvent, key: string): void => {
    event.stopPropagation();
    onClose(key);
  };

  if (chats.length === 0) {
    return <div className={POPUP_EMPTY_CLASS}>{trans.__('No chat found')}</div>;
  }

  return (
    <ul ref={listRef} className={POPUP_LIST_CLASS}>
      {chats.map(({ key, name }) => {
        const isLoaded = loadedModels.has(key);
        return (
          <li
            key={key}
            data-chat-key={key}
            className={`${POPUP_ITEM_CLASS} ${
              key === selectedKey ? POPUP_ITEM_ACTIVE_CLASS : ''
            }`}
            onClick={() => onSelect(key)}
            onMouseEnter={() => onUpdateSelectedKey(key)}
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
                  onClick={e => handleCloseClick(e, key)}
                  appearance="stealth"
                  title={trans.__('Close and dispose this chat')}
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
