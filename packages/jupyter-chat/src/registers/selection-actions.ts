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
import { IInputModel } from '../input-model';
import { IChatModel } from '../model';
import { IAttachment, IAttachmentSelection } from '../types';

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
export type SelectionActionContext = {
  /**
   * The path of the document containing the selection, relative to
   * `ContentsManager.root_dir` (`drive:path` for a document of another drive).
   */
  path: string;

  /**
   * The ID of the cell containing the selection, if the document is a notebook.
   */
  cellId?: string;

  /**
   * The type of the cell containing the selection, if the document is a
   * notebook.
   */
  cellType?: 'code' | 'markdown' | 'raw';

  /**
   * The selected range and its content.
   */
  selection: IAttachmentSelection;

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
      isEnabled: ({ inputModel, openNewChat }) => !!inputModel || !!openNewChat,
      run: async ({
        inputModel,
        openNewChat,
        path,
        cellId,
        cellType,
        selection
      }) => {
        const tooLong = () =>
          Notification.warning(
            trans.__(
              'The selection is longer than %1 characters and was not added to the chat.',
              Private.MAX_ATTACHED_LENGTH
            ),
            { autoClose: 5000 }
          );
        const notAttached = () =>
          Notification.warning(
            trans.__(
              'The selection is longer than %1 characters and could not be attached to the chat.',
              Private.MAX_INSERTED_LENGTH
            ),
            { autoClose: 5000 }
          );
        const length = selection.content.length;
        const inline = length <= Private.MAX_INSERTED_LENGTH;
        // Check what can be known before opening a chat for it.
        if (length > Private.MAX_ATTACHED_LENGTH) {
          tooLong();
          return;
        }
        if (!inline && cellId !== undefined && !cellType) {
          notAttached();
          return;
        }
        const input = inputModel ?? (await openNewChat?.())?.input;
        if (!input || input.isDisposed) {
          return;
        }

        if (inline) {
          // The header comes first: it keeps a selection starting with "/" from
          // being read as a slash command. The text is sent as typed text, so
          // command providers such as mentions act on it, as on a paste.
          const head = Private.trimEnd(input.value);
          input.value =
            (head ? `${head}\n\n` : '') +
            Private.selectionText(path, cellId, selection) +
            '\n';
          input.cursorIndex = input.value.length;
          input.focus();
          return;
        }

        if (!input.addAttachment) {
          notAttached();
          return;
        }
        const attachment: IAttachment =
          cellId !== undefined
            ? {
                type: 'notebook',
                value: path,
                mimetype: 'application/x-ipynb+json',
                cells: [{ id: cellId, input_type: cellType!, selection }]
              }
            : { type: 'file', value: path, selection };
        input.addAttachment(attachment);
        Notification.info(
          trans.__(
            'The selection is longer than %1 characters: the file is attached instead.',
            Private.MAX_INSERTED_LENGTH
          ),
          { autoClose: 5000 }
        );
        input.focus();
      }
    });
    return registry;
  }
}

namespace Private {
  /**
   * The maximum length, in UTF-16 code units, of a selection inserted in the
   * chat input as text.
   */
  export const MAX_INSERTED_LENGTH = 20_000;

  /**
   * The maximum length of a selection added as an attachment instead: an
   * attachment is stored in the chat document.
   */
  export const MAX_ATTACHED_LENGTH = 1_000_000;

  /**
   * The text inserted in the chat input for a selection: a header line with the
   * path, the cell and the lines, then the content in a fenced block.
   */
  export function selectionText(
    path: string,
    cellId: string | undefined,
    selection: IAttachmentSelection
  ): string {
    // Only an id that follows the nbformat rule is written.
    const cell =
      cellId && /^[\w-]{1,64}$/.test(cellId)
        ? ` (cell ${codeSpan(cellId)})`
        : '';
    const range = ` lines ${selection.start[0] + 1}-${selection.end[0] + 1}`;
    const { content } = selection;
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(content) + 1));
    const newline = content.endsWith('\n') ? '' : '\n';
    return (
      `From ${codeSpan(path)}${cell}${range}:\n` +
      `${fence}\n${content}${newline}${fence}`
    );
  }

  /**
   * The text without its trailing whitespace (`String.trimEnd` is not in the
   * compilation target).
   */
  export function trimEnd(text: string): string {
    let end = text.length;
    while (end > 0 && /\s/.test(text[end - 1])) {
      end--;
    }
    return text.slice(0, end);
  }

  /**
   * The length of the longest run of backticks in a text.
   */
  function longestBacktickRun(text: string): number {
    return (text.match(/`+/g) ?? []).reduce(
      (longest, run) => Math.max(longest, run.length),
      0
    );
  }

  /**
   * Wrap a text in a markdown code span that no backtick inside can end early,
   * and that stays on one line.
   */
  function codeSpan(text: string): string {
    const line = text.replace(/[\r\n\u2028\u2029]/g, ' ');
    const ticks = '`'.repeat(longestBacktickRun(line) + 1);
    return `${ticks} ${line} ${ticks}`;
  }
}
