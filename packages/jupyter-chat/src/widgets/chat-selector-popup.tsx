/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactWidget } from '@jupyterlab/ui-components';
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
        onSelect={this._handleItemClick.bind(this)}
        onUpdateSelectedIndex={this._handleUpdateSelectedIndex.bind(this)}
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

  private _handleItemClick(index: number): void {
    this._selectedIndex = index;
    this.selectCurrent();
  }

  private _handleUpdateSelectedIndex(index: number): void {
    this._selectedIndex = index;
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
  private _query: string = '';
  private _selectedIndex: number = 0;
  private _onSelect?: (value: string) => void;
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
  onSelect: (index: number) => void;
  onUpdateSelectedIndex: (index: number) => void;
}

/**
 * React component for rendering the chat list.
 */
function ChatSelectorList({
  chatNames,
  query,
  selectedIndex,
  onSelect,
  onUpdateSelectedIndex
}: IChatSelectorListProps): JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const [entries, setEntries] = useState<Array<[string, string]>>([]);

  // Filter entries based on query
  useEffect(() => {
    const allEntries = Object.entries(chatNames);
    if (!query.trim()) {
      setEntries(allEntries);
    } else {
      const queryLower = query.toLowerCase();
      setEntries(
        allEntries.filter(([name]) => name.toLowerCase().includes(queryLower))
      );
    }
  }, [chatNames, query]);

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

  if (entries.length === 0) {
    return <div className={POPUP_EMPTY_CLASS}>No chats found</div>;
  }

  return (
    <ul ref={listRef} className={POPUP_LIST_CLASS}>
      {entries.map(([name, value], index) => (
        <li
          key={value}
          className={`${POPUP_ITEM_CLASS} ${
            index === selectedIndex ? POPUP_ITEM_ACTIVE_CLASS : ''
          }`}
          onClick={() => onSelect(index)}
          onMouseEnter={() => onUpdateSelectedIndex(index)}
        >
          <div className={POPUP_ITEM_LABEL_CLASS}>{name}</div>
        </li>
      ))}
    </ul>
  );
}
