/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { ReactWidget } from '@jupyterlab/ui-components';
import { Token } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { Widget } from '@lumino/widgets';
import { Theme, ThemeProvider } from '@mui/material/styles';
import * as React from 'react';

import {
  AttachButton,
  CancelButton,
  SaveEditButton,
  SendButton
} from './buttons';
import { Chat } from '../chat';
import { ChatReactContext } from '../../context';
import { IInputModel } from '../../input-model';
import { IChatCommandRegistry } from '../../registers';
import { IChatModel } from '../../model';

/**
 * The toolbar registry interface.
 */
export interface IInputToolbarRegistry {
  /**
   * A signal emitting when the items has changed.
   */
  readonly itemsChanged: ISignal<IInputToolbarRegistry, void>;
  /**
   * All toolbar items in order (keyed by registry name), including hidden
   * ones. Consumers that render the toolbar should prefer this over
   * `getItems()`: it exposes the registry name so the toolbar can key its
   * children by name, and hiding/showing an item is a visibility toggle on
   * the same widget rather than a dispose/recreate cycle.
   */
  readonly items: ReadonlyMap<string, InputToolbarRegistry.IToolbarItem>;
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
   * Remove a toolbar item. No-op if `name` isn't registered.
   */
  removeItem(name: string): void;

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
   * All toolbar items in order (keyed by registry name), including hidden ones.
   */
  get items(): ReadonlyMap<string, InputToolbarRegistry.IToolbarItem> {
    const sorted = Array.from(this._items.entries()).sort(
      ([, a], [, b]) => a.position - b.position
    );
    return new Map(sorted);
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
    return Array.from(this.items.values()).filter(item => !item.hidden);
  }

  /**
   * Add a toolbar item.
   *
   * The deprecated `element` form is normalized at registration time to the
   * `createWidget` factory form, so downstream code only has to deal with the
   * widget factory.
   */
  addItem(name: string, item: InputToolbarRegistry.IToolbarItem): void {
    if (this._items.has(name)) {
      console.warn(`A chat input toolbar item '${name}' is already registered`);
      return;
    }
    const createWidget =
      item.createWidget ??
      (item.element
        ? InputToolbarRegistry.createReactToolbarItem(item.element)
        : undefined);
    if (!createWidget) {
      console.error(
        `Chat input toolbar item '${name}' has neither 'createWidget' nor 'element'`
      );
      return;
    }
    this._items.set(name, { ...item, createWidget });
    this._itemsChanged.emit();
  }

  /**
   * Remove a toolbar item. No-op if `name` isn't registered. The hosting
   * ChatInput's sync loop disposes the matching widget on the next
   * `itemsChanged` emission.
   */
  removeItem(name: string): void {
    if (this._items.delete(name)) {
      this._itemsChanged.emit();
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
   *
   * Items must provide either `createWidget` (preferred) or the deprecated
   * `element` React component. The registry normalizes `element` into a
   * `createWidget` factory at registration time.
   */
  export interface IToolbarItem {
    /**
     * Factory producing the Lumino widget to insert into the toolbar.
     *
     * The context is captured when the widget is created and is not reactive;
     * if the host chat remounts (e.g. switching edit mode), a new widget is
     * built with a fresh context.
     */
    createWidget?: ToolbarItemFactory;
    /**
     * The React functional component with the button.
     *
     * NOTE: This component must be a TooltippedButton for a good integration
     * in the toolbar.
     *
     * @deprecated Provide `createWidget` instead; use
     * {@link createReactToolbarItem} to wrap an existing React component.
     */
    element?: React.FunctionComponent<IToolbarItemProps>;
    /**
     * The position of the button in the toolbar.
     */
    position: number;
    /**
     * Whether the button is hidden or not.
     */
    hidden?: boolean;
    /**
     * If true, the item is rendered in a fixed slot next to the toolbar
     * instead of inside the `ReactiveToolbar`, so it never moves into the
     * overflow popup. The item itself may still choose to not paint (e.g.
     * `SendButton` when the input is empty) — "pinned" means "exempt from
     * overflow", not "always visible".
     */
    pinned?: boolean;
  }

  /**
   * The toolbar item properties, send to the button.
   */
  export interface IToolbarItemProps {
    /**
     * The input model of the input component including the button.
     */
    model: IInputModel;
    /**
     * Chat command registry. Should be used by the "Send" button to run
     * `onSubmit()` on all command providers before sending the message.
     */
    chatCommandRegistry?: IChatCommandRegistry;
    /**
     * The chat model. Provides access to messages, writers, and other chat state.
     */
    chatModel?: IChatModel;
    /**
     * Whether the input is in edit mode (editing an existing message).
     * Defaults to false (new message mode).
     */
    edit?: boolean;
  }

  /**
   * Context passed to a {@link ToolbarItemFactory}. Extends the React props
   * with the Lumino/React bridges that a React widget needs (MUI theme and
   * the shared chat context) so factory authors can build either plain Lumino
   * widgets or React widgets rooted outside of the host component tree.
   */
  export interface IToolbarItemContext extends IToolbarItemProps {
    /**
     * The MUI theme in effect when the host chat was last rendered.
     */
    theme: Theme;
    /**
     * The chat context exposed to React descendants of the host chat.
     */
    chatContext: Chat.IChatProps;
  }

  /**
   * Factory signature for a toolbar item: produces the Lumino widget to
   * insert into the toolbar from the current host context.
   */
  export type ToolbarItemFactory = (context: IToolbarItemContext) => Widget;

  /**
   * Wrap a React component (receiving {@link IToolbarItemProps}) into a
   * {@link ToolbarItemFactory}. The resulting widget hosts the component
   * under the MUI theme and chat context so that hooks like
   * `useChatContext()` keep working across the Lumino widget boundary.
   */
  export function createReactToolbarItem(
    Comp: React.FunctionComponent<IToolbarItemProps>
  ): ToolbarItemFactory {
    return context => {
      const { theme, chatContext, ...props } = context;
      return ReactWidget.create(
        <ThemeProvider theme={theme}>
          <ChatReactContext.Provider value={chatContext}>
            <Comp {...props} />
          </ChatReactContext.Provider>
        </ThemeProvider>
      );
    };
  }

  /**
   * The default toolbar registry if none is provided.
   */
  export function defaultToolbarRegistry(): InputToolbarRegistry {
    const registry = new InputToolbarRegistry();
    registry.addItem('send', {
      createWidget: createReactToolbarItem(SendButton),
      position: 100,
      pinned: true
    });
    registry.addItem('saveEdit', {
      createWidget: createReactToolbarItem(SaveEditButton),
      position: 95,
      pinned: true
    });
    registry.addItem('attach', {
      createWidget: createReactToolbarItem(AttachButton),
      position: 20
    });
    registry.addItem('cancel', {
      createWidget: createReactToolbarItem(CancelButton),
      position: 10
    });
    return registry;
  }
}

/**
 * A factory interface for creating a new Input Toolbar Registry
 * for each Chat Panel.
 */
export interface IInputToolbarRegistryFactory {
  /**
   * Create a new input toolbar registry instance.
   */
  create: () => IInputToolbarRegistry;
}

/**
 * The token of the factory to create an input toolbar registry.
 */
export const IInputToolbarRegistryFactory =
  new Token<IInputToolbarRegistryFactory>(
    '@jupyter/chat:IInputToolbarRegistryFactory'
  );
