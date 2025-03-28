/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import * as React from 'react';

import { AttachButton, CancelButton, SendButton } from './buttons';
import { IInputModel } from '../../input-model';
import { ISignal, Signal } from '@lumino/signaling';

/**
 * The toolbar registry interface.
 */
export interface IInputToolbarRegistry {
  /**
   * A signal emitting when the items has changed.
   */
  readonly itemsChanged: ISignal<IInputToolbarRegistry, void>;
  /**
   * Get a toolbar item.
   */
  get(name: string): InputToolbarRegistry.IToolbarItem | undefined;

  /**
   * Get the list of the visible toolbar items in order.
   */
  getItems(): InputToolbarRegistry.IToolbarItem[];

  /**
   * Add a toolbar item.
   */
  addItem(name: string, item: InputToolbarRegistry.IToolbarItem): void;

  /**
   * Hide an element.
   */
  hide(name: string): void;

  /**
   * Show an element.
   */
  show(name: string): void;
}

/**
 * The toolbar registry implementation.
 */
export class InputToolbarRegistry implements IInputToolbarRegistry {
  /**
   * A signal emitting when the items has changed.
   */
  get itemsChanged(): ISignal<IInputToolbarRegistry, void> {
    return this._itemsChanged;
  }

  /**
   * Get a toolbar item.
   */
  get(name: string): InputToolbarRegistry.IToolbarItem | undefined {
    return this._items.get(name);
  }

  /**
   * Get the list of the visible toolbar items in order.
   */
  getItems(): InputToolbarRegistry.IToolbarItem[] {
    return Array.from(this._items.values())
      .filter(item => !item.hidden)
      .sort((a, b) => a.position - b.position);
  }

  /**
   * Add a toolbar item.
   */
  addItem(name: string, item: InputToolbarRegistry.IToolbarItem): void {
    if (!this._items.has(name)) {
      this._items.set(name, item);
      this._itemsChanged.emit();
    } else {
      console.warn(`A chat input toolbar item '${name}' is already registered`);
    }
  }

  /**
   * Hide an element.
   */
  hide(name: string): void {
    const item = this._items.get(name);
    if (item) {
      item.hidden = true;
      this._itemsChanged.emit();
    }
  }

  /**
   * Show an element.
   */
  show(name: string): void {
    const item = this._items.get(name);
    if (item) {
      item.hidden = false;
      this._itemsChanged.emit();
    }
  }

  private _items = new Map<string, InputToolbarRegistry.IToolbarItem>();
  private _itemsChanged = new Signal<this, void>(this);
}

export namespace InputToolbarRegistry {
  /**
   * The toolbar item interface.
   */
  export interface IToolbarItem {
    /**
     * The react functional component with the button.
     *
     * NOTE:
     * This component must be a TooltippedButton for a good integration in the toolbar.
     */
    element: React.FunctionComponent<IToolbarItemProps>;
    /**
     * The position of the button in the toolbar.
     */
    position: number;
    /**
     * Whether the button is hidden or not.
     */
    hidden?: boolean;
  }

  /**
   * The toolbar item properties, send to the button.
   */
  export interface IToolbarItemProps {
    /**
     * The input model of the input component including the button.
     */
    model: IInputModel;
  }

  /**
   * The default toolbar registry if none is provided.
   */
  export function defaultToolbarRegistry(): InputToolbarRegistry {
    const registry = new InputToolbarRegistry();

    registry.addItem('send', {
      element: SendButton,
      position: 100
    });
    registry.addItem('attach', {
      element: AttachButton,
      position: 20
    });
    registry.addItem('cancel', {
      element: CancelButton,
      position: 10
    });
    return registry;
  }
}
