/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Notification } from '@jupyterlab/apputils';
import { TranslationBundle } from '@jupyterlab/translation';
import { LabIcon } from '@jupyterlab/ui-components';
import { Token } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { chatIcon } from '../icons';
import { IInputModel, MAX_SNIPPET_LENGTH } from '../input-model';
import { IChatModel } from '../model';
import { PendingSnippet } from '../types';

/**
 * The ID of the built-in "Add to chat" action.
 */
export const ADD_TO_CHAT_ACTION_ID = 'jupyter-chat:add-to-chat';

/**
 * The token for the selection action registry, which can be provided by an
 * extension using @jupyter/chat package.
 */
export const ISelectionActionRegistry = new Token<ISelectionActionRegistry>(
  '@jupyter/chat:ISelectionActionRegistry',
  'The registry of the actions offered over an editor selection'
);

/**
 * Interface of a selection action registry, which tracks the actions offered
 * in the popup displayed over a selection in an editor.
 */
export interface ISelectionActionRegistry {
  /**
   * A signal emitting when the list of actions has changed.
   */
  readonly itemsChanged: ISignal<ISelectionActionRegistry, void>;

  /**
   * Adds an action to the registry.
   */
  addAction(action: SelectionAction): void;

  /**
   * Lists all actions previously added via `addAction()`, in insertion order.
   */
  getActions(): SelectionAction[];
}

/**
 * The context handed to an action.
 */
export type SelectionActionContext = PendingSnippet & {
  /**
   * The chat input of the destination chat, or `null` if there is none.
   */
  inputModel: IInputModel | null;

  /**
   * The destination chat, for actions that post to the chat or watch its
   * writers, or `null` if there is none. It comes from the same chat as
   * `inputModel`.
   */
  chatModel: IChatModel | null;

  /**
   * Creates and opens a new chat, and resolves with it, or with `null` if it
   * could not. Set only when no chat is open and the host can open one.
   */
  openNewChat?: () => Promise<IChatModel | null>;
};

/**
 * An action offered in the selection popup.
 */
export type SelectionAction = {
  /**
   * ID of the action, unique within the registry.
   */
  id: string;

  /**
   * The label of the action, displayed in the popup and as its tooltip.
   */
  label: string;

  /**
   * If set, this will be rendered as the icon of the action, before its label.
   * Jupyter Chat will render the label alone if this is unset.
   */
  icon?: LabIcon | JSX.Element | string | null;

  /**
   * Whether the action can run for this context. An action is enabled if this
   * is unset.
   */
  isEnabled?(context: SelectionActionContext): boolean;

  /**
   * Why the action is disabled for this context, displayed as the tooltip of
   * the disabled button. The label is displayed if this is unset. It is only a
   * tooltip: do not rely on it to convey information.
   */
  disabledReason?(context: SelectionActionContext): string;

  /**
   * Whether running the action reveals the destination chat. Defaults to
   * `true`.
   */
  revealsDestination?: boolean;

  /**
   * A signal emitting when the enabled state of the action changed for a
   * reason no chat signal reports.
   */
  readonly stateChanged?: ISignal<unknown, void>;

  /**
   * Called when the user triggers the action.
   */
  run(context: SelectionActionContext): void | Promise<void>;
};

/**
 * Default selection action registry implementation.
 */
export class SelectionActionRegistry implements ISelectionActionRegistry {
  /**
   * A signal emitting when the list of actions has changed.
   */
  get itemsChanged(): ISignal<ISelectionActionRegistry, void> {
    return this._itemsChanged;
  }

  /**
   * Adds an action to the registry.
   */
  addAction(action: SelectionAction): void {
    if (this._actions.has(action.id)) {
      console.warn(`A selection action '${action.id}' is already registered`);
      return;
    }
    this._actions.set(action.id, action);
    this._itemsChanged.emit();
  }

  /**
   * Lists all actions previously added via `addAction()`, in insertion order.
   */
  getActions(): SelectionAction[] {
    return Array.from(this._actions.values());
  }

  private _actions = new Map<string, SelectionAction>();
  private _itemsChanged = new Signal<this, void>(this);
}

export namespace SelectionActionRegistry {
  /**
   * The default registry, providing the "Add to chat" action.
   */
  export function defaultRegistry(
    trans: TranslationBundle
  ): SelectionActionRegistry {
    const registry = new SelectionActionRegistry();

    registry.addAction({
      id: ADD_TO_CHAT_ACTION_ID,
      label: trans.__('Add to chat'),
      icon: chatIcon,
      isEnabled: ({ inputModel, openNewChat }) =>
        !!inputModel?.addPendingSnippet || !!openNewChat,
      run: async ({ inputModel, openNewChat, path, cellId, selection }) => {
        const warnTooLong = () =>
          Notification.warning(
            trans.__(
              'The selection is longer than %1 characters and was not added to the chat.',
              MAX_SNIPPET_LENGTH
            ),
            { autoClose: 5000 }
          );
        // Do not open a chat for a selection that cannot be staged.
        if (selection.content.length > MAX_SNIPPET_LENGTH) {
          warnTooLong();
          return;
        }
        const input = inputModel ?? (await openNewChat?.())?.input;
        if (!input?.addPendingSnippet) {
          return;
        }
        // Stage the fields explicitly: the context carries more than a snippet.
        if (!input.addPendingSnippet({ path, cellId, selection })) {
          warnTooLong();
          return;
        }
        input.focus();
      }
    });
    return registry;
  }
}
