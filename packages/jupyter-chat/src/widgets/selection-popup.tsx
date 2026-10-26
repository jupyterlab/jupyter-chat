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
import { LabIcon, ReactWidget } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import React from 'react';

import { TRANSLATION_DOMAIN } from '../context';
import {
  ISelectionActionRegistry,
  SelectionAction,
  SelectionActionContext
} from '../registers';

const POPUP_CLASS = 'jp-chat-selection-popup';
const POPUP_TOOLBAR_CLASS = 'jp-chat-selection-popup-toolbar';
const POPUP_ACTION_CLASS = 'jp-chat-selection-popup-action';
const POPUP_LABEL_CLASS = 'jp-chat-selection-popup-label';

/**
 * The gap, in pixels, between the popup and the selection.
 */
const POPUP_MARGIN = 8;

/**
 * The delay, in milliseconds, between two placements of a popup that has a
 * context.
 */
const POPUP_REPOSITION_INTERVAL = 250;

/**
 * A popup widget displaying the registered actions over an editor selection.
 */
export class SelectionPopup extends ReactWidget {
  constructor(options: SelectionPopup.IOptions) {
    super();
    this.addClass(POPUP_CLASS);
    // Attached outside the shell: JupyterLab scopes its styles to this class.
    this.addClass('jp-ThemedContainer');
    this._registry = options.registry;
    this._beforeRun = options.beforeRun;
    this._reposition = options.reposition;
    this._trans = (options.translator ?? nullTranslator).load(
      TRANSLATION_DOMAIN
    );
    this._registry.itemsChanged.connect(this._onActionsChanged, this);

    // Start hidden
    this.hide();
  }

  /**
   * A signal emitting when the user dismissed the popup, with the reason.
   */
  get dismissed(): ISignal<SelectionPopup, SelectionPopup.DismissReason> {
    return this._dismissed;
  }

  /**
   * Getter/setter of the context the actions apply to.
   *
   * Setting it to `null` hides the popup.
   */
  get context(): SelectionActionContext | null {
    return this._context;
  }
  set context(context: SelectionActionContext | null) {
    this._context = context;
    this._setPositionListeners(!!context);
    if (!context) {
      this.hide();
    } else if (this.isVisible) {
      this._watchState();
    }
    this.update();
  }

  /**
   * Show the popup next to the end of a selection, or hide it if the end is
   * not within the bounds or if no action is enabled.
   *
   * @param rect - the client rectangle of the end of the selection, or `null`
   * if it is unknown.
   * @param bounds - the client rectangle the popup must stay in.
   */
  placeAt(
    rect: { left: number; top: number; bottom: number } | null,
    bounds: SelectionPopup.IBounds
  ): void {
    if (!this._hasEnabledAction()) {
      this.hide();
      return;
    }
    // A hidden widget measures 0 by 0.
    this.show();
    const { width, height } = this.node.getBoundingClientRect();
    const position = placeSelectionPopup(rect, bounds, { width, height });
    if (!position) {
      this.hide();
      return;
    }
    this.node.style.top = `${position.top}px`;
    this.node.style.left = `${position.left}px`;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    // Disposing a visible widget does not send an after-hide message.
    this._removeVisibleListeners();
    this._unwatchState();
    this._setPositionListeners(false);
    this._registry.itemsChanged.disconnect(this._onActionsChanged, this);
    super.dispose();
  }

  render(): JSX.Element {
    return (
      <SelectionActionList
        actions={this._registry.getActions()}
        context={this._context}
        onRun={this._handleRun}
        trans={this._trans}
      />
    );
  }

  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
    document.addEventListener('pointerdown', this._handleOutsideClick, true);
    document.addEventListener('keydown', this._handleKeyDown, true);
    this._watchState();
  }

  protected onAfterHide(msg: Message): void {
    this._removeVisibleListeners();
    this._unwatchState();
    super.onAfterHide(msg);
  }

  private _removeVisibleListeners(): void {
    document.removeEventListener('pointerdown', this._handleOutsideClick, true);
    document.removeEventListener('keydown', this._handleKeyDown, true);
  }

  /**
   * Add or remove the listeners that keep the popup on its selection. They
   * live as long as there is a context, also while the popup is hidden because
   * the selection scrolled out of view.
   */
  private _setPositionListeners(listen: boolean): void {
    if (listen === this._listeningToPosition) {
      return;
    }
    this._listeningToPosition = listen;
    if (listen) {
      // `scroll` does not bubble: capture it to catch any scroller.
      document.addEventListener('scroll', this._handleReposition, true);
      window.addEventListener('resize', this._handleReposition);
      // Nothing is fired when the layout moves without a scroll or a resize: a
      // panel toggled by a shortcut, or the output of a cell above.
      this._repositionTimer = window.setInterval(
        this._handleReposition,
        POPUP_REPOSITION_INTERVAL
      );
    } else {
      document.removeEventListener('scroll', this._handleReposition, true);
      window.removeEventListener('resize', this._handleReposition);
      window.clearInterval(this._repositionTimer);
    }
  }

  /**
   * Re-evaluate the actions on the changes that enable or disable them while
   * the popup is visible.
   */
  private _watchState(): void {
    this._unwatchState();
    const chatModel = this._context?.chatModel;
    if (chatModel) {
      chatModel.writersChanged?.connect(this._onStateChanged, this);
      chatModel.messagesUpdated.connect(this._onStateChanged, this);
      this._watched.chatModel = chatModel;
    }
    for (const action of this._registry.getActions()) {
      if (action.stateChanged) {
        action.stateChanged.connect(this._onStateChanged, this);
        this._watched.signals.push(action.stateChanged);
      }
    }
  }

  private _unwatchState(): void {
    const { chatModel, signals } = this._watched;
    chatModel?.writersChanged?.disconnect(this._onStateChanged, this);
    chatModel?.messagesUpdated.disconnect(this._onStateChanged, this);
    signals.forEach(signal => signal.disconnect(this._onStateChanged, this));
    this._watched = { chatModel: null, signals: [] };
  }

  private _onActionsChanged(): void {
    if (this.isVisible) {
      this._watchState();
    }
    this._onStateChanged();
  }

  private _onStateChanged(): void {
    if (this.isVisible && !this._hasEnabledAction()) {
      this.hide();
      return;
    }
    this.update();
  }

  private _hasEnabledAction(): boolean {
    const context = this._context;
    return (
      !!context &&
      this._registry
        .getActions()
        .some(action => selectionActionState(action, context).enabled)
    );
  }

  private _dismiss(reason: SelectionPopup.DismissReason): void {
    this.hide();
    this._dismissed.emit(reason);
  }

  private _handleRun = async (action: SelectionAction): Promise<void> => {
    const context = this._context;
    this._dismiss('run');
    if (!context) {
      return;
    }
    try {
      const resolved = this._beforeRun
        ? this._beforeRun(action, context)
        : context;
      if (resolved) {
        await action.run(resolved);
      }
    } catch (e) {
      console.error(`The selection action '${action.id}' failed`, e);
    }
  };

  private _handleOutsideClick = (event: MouseEvent): void => {
    if (!this.node.contains(event.target as Node)) {
      this._dismiss('outside');
    }
  };

  private _handleKeyDown = (event: KeyboardEvent): void => {
    // Do not stop the propagation: other handlers, such as the completer's,
    // have to see the key too.
    if (event.key === 'Escape') {
      this._dismiss('escape');
    }
  };

  private _handleReposition = (): void => {
    this._reposition?.();
  };

  private _registry: ISelectionActionRegistry;
  private _beforeRun: SelectionPopup.IOptions['beforeRun'];
  private _reposition: SelectionPopup.IOptions['reposition'];
  private _context: SelectionActionContext | null = null;
  private _trans: TranslationBundle;
  private _listeningToPosition = false;
  private _repositionTimer = 0;
  private _watched: {
    chatModel: SelectionActionContext['chatModel'];
    signals: ISignal<unknown, void>[];
  } = { chatModel: null, signals: [] };
  private _dismissed = new Signal<SelectionPopup, SelectionPopup.DismissReason>(
    this
  );
}

/**
 * Namespace for SelectionPopup.
 */
export namespace SelectionPopup {
  export interface IOptions {
    /**
     * The registry providing the actions to display.
     */
    registry: ISelectionActionRegistry;
    /**
     * The translator for internationalization.
     */
    translator?: ITranslator;
    /**
     * Called when the user triggers an action, with the context the popup
     * holds. It returns the context the action runs with, or `null` to cancel
     * the run.
     */
    beforeRun?: (
      action: SelectionAction,
      context: SelectionActionContext
    ) => SelectionActionContext | null;
    /**
     * Called when the popup has to follow its selection again: when a scroller
     * scrolls or the window is resized.
     */
    reposition?: () => void;
  }

  /**
   * A position in viewport coordinates.
   */
  export interface IPosition {
    top: number;
    left: number;
  }

  /**
   * A rectangle in viewport coordinates.
   */
  export type IBounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>;

  /**
   * Why the user dismissed the popup.
   */
  export type DismissReason = 'escape' | 'outside' | 'run';
}

/**
 * Compute the position of the popup next to the end of a selection.
 *
 * The popup is above the end of the selection, below it if there is no room
 * above, and stays inside the bounds.
 *
 * @param rect - the client rectangle of the end of the selection, or `null` if
 * unknown. CodeMirror gives one for a position scrolled out of its scroller too.
 * @param bounds - the client rectangle of the scroller of the document.
 * @param size - the size of the popup, which is measured once shown.
 * @returns the position, or `null` if the popup has to be hidden: the end of
 * the selection is unknown, or outside the bounds.
 */
export function placeSelectionPopup(
  rect: { left: number; top: number; bottom: number } | null,
  bounds: SelectionPopup.IBounds,
  size: { width: number; height: number }
): SelectionPopup.IPosition | null {
  if (
    !rect ||
    rect.left < bounds.left ||
    rect.left > bounds.right ||
    rect.bottom < bounds.top ||
    rect.bottom > bounds.bottom
  ) {
    return null;
  }

  let top = rect.top - size.height - POPUP_MARGIN;
  if (top < bounds.top) {
    top = rect.bottom + POPUP_MARGIN;
  }
  top = Math.min(top, bounds.bottom - size.height);
  const left = Math.min(rect.left, bounds.right - size.width);
  return { top, left };
}

/**
 * Whether an action is enabled for a context, and the tooltip of its button.
 *
 * A disabled action gives its reason as tooltip, or its label if it has none.
 */
function selectionActionState(
  action: SelectionAction,
  context: SelectionActionContext | null
): { enabled: boolean; title: string } {
  const enabled = !!context && (action.isEnabled?.(context) ?? true);
  const title =
    !enabled && context
      ? (action.disabledReason?.(context) ?? action.label)
      : action.label;
  return { enabled, title };
}

/**
 * Props for the SelectionActionList component.
 */
interface ISelectionActionListProps {
  actions: SelectionAction[];
  context: SelectionActionContext | null;
  onRun: (action: SelectionAction) => void;
  trans: TranslationBundle;
}

/**
 * React component for rendering the actions.
 */
function SelectionActionList(props: ISelectionActionListProps): JSX.Element {
  const { actions, context, onRun, trans } = props;

  return (
    <div
      className={POPUP_TOOLBAR_CLASS}
      role="group"
      aria-label={trans.__('Selection actions')}
    >
      {actions.map(action => {
        const { enabled, title } = selectionActionState(action, context);
        return (
          <Button
            key={action.id}
            appearance="stealth"
            className={POPUP_ACTION_CLASS}
            title={title}
            aria-label={action.label}
            aria-disabled={!enabled}
            disabled={!enabled}
            // Keep the selection of the editor.
            onMouseDown={event => event.preventDefault()}
            onClick={() => onRun(action)}
          >
            {renderIcon(action)}
            {action.icon && (
              <span className={POPUP_LABEL_CLASS}>{action.label}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Render the icon of an action, falling back to its label.
 */
function renderIcon(action: SelectionAction): JSX.Element {
  if (React.isValidElement(action.icon)) {
    return action.icon;
  }
  return (
    <span>
      {action.icon instanceof LabIcon ? (
        <action.icon.react tag={null} />
      ) : (
        (action.icon ?? action.label)
      )}
    </span>
  );
}
