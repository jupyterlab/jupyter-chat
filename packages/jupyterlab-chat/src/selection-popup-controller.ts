/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  IChatModel,
  IChatPanel,
  IChatTracker,
  ISelectionWatcher,
  SelectionAction,
  SelectionActionContext,
  SelectionPopup,
  SelectionWatcher,
  getEditor,
  selectionFromOffsets,
  selectionsEqual
} from '@jupyter/chat';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { Notebook } from '@jupyterlab/notebook';

/**
 * The editor of a cell, or of a file.
 */
type IEditor = NonNullable<NonNullable<Notebook['activeCell']>['editor']>;

/**
 * The popup, as the controller uses it.
 */
export type ISelectionPopup = Pick<SelectionPopup, 'placeAt' | 'dismissed'> & {
  context: SelectionActionContext | null;
};

/**
 * Find the chat an action on a selection applies to: the current chat if it is
 * visible, else the first visible chat, else the current chat, else the first
 * chat. The chat can be hidden: revealing it is left to the caller.
 *
 * @returns the chat, or `null` if there is no chat.
 */
export function resolveSelectionDestination(
  tracker: IChatTracker
): IChatPanel | null {
  const current = tracker.currentWidget;
  if (current?.isVisible) {
    return current;
  }
  return (
    tracker.find(widget => widget.isVisible) ??
    current ??
    tracker.find(() => true) ??
    null
  );
}

/**
 * Show and hide the popup over the selection of the editors, as the user
 * selects text, and build the context of its actions.
 *
 * Nothing is listened to while the controller is not enabled.
 */
export class SelectionPopupController {
  constructor(options: SelectionPopupController.IOptions) {
    this._document = options.document;
    this._watcher = options.watcher;
    this._popup = options.popup;
    this._getEditor = options.getEditor;
    this._getWidget = options.getWidget;
    this._resolveDestination = options.resolveDestination;
    this._reveal = options.reveal;
    this._openNewChat = options.openNewChat;
    this._isEnabled = options.isEnabled;
  }

  /**
   * Start or stop listening, according to the setting. Call it when the
   * setting changes.
   */
  update(): void {
    const enabled = this._isEnabled();
    if (enabled === this._listening) {
      return;
    }
    this._listening = enabled;
    if (enabled) {
      this._document.addEventListener('pointerdown', this._onPointerDown, true);
      this._document.addEventListener('pointerup', this._onPointerUp, true);
      this._document.addEventListener(
        'pointercancel',
        this._onPointerCancel,
        true
      );
      this._watcher.selectionChanged.connect(this._onSelectionChanged, this);
      this._popup.dismissed.connect(this._onDismissed, this);
      this._dismissed = null;
      this._show();
    } else {
      this._document.removeEventListener(
        'pointerdown',
        this._onPointerDown,
        true
      );
      this._document.removeEventListener('pointerup', this._onPointerUp, true);
      this._document.removeEventListener(
        'pointercancel',
        this._onPointerCancel,
        true
      );
      this._watcher.selectionChanged.disconnect(this._onSelectionChanged, this);
      this._popup.dismissed.disconnect(this._onDismissed, this);
      this._pressed = false;
      this._pressTarget = null;
      this._dismissed = null;
      this._popup.context = null;
    }
  }

  /**
   * Show the popup next to the selection again, after a scroll, a resize or a
   * tick of the popup's timer. At most once per frame.
   */
  reposition = (): void => {
    if (!this._listening || this._frame) {
      return;
    }
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      // The setting may have turned off while the frame was pending.
      if (this._listening) {
        this._show();
      }
    });
  };

  /**
   * Build the context to run an action with, from what is selected in the
   * editor now: the selection of the watcher can be 200 ms old. Reveal the
   * destination chat if the action needs it, and hide the popup.
   *
   * @returns the context, or `null` if nothing is selected.
   */
  beforeRun(action: SelectionAction): SelectionActionContext | null {
    const watched = this._watcher.selection;
    const widget = watched && this._getWidget(watched.widgetId);
    const editor = widget && this._getEditor(widget);
    if (!widget || !editor) {
      return null;
    }
    const from = editor.getOffsetAt(editor.getSelection().start);
    const to = editor.getOffsetAt(editor.getSelection().end);
    if (from === to) {
      return null;
    }
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const text = editor.model.sharedModel.getSource().slice(start, end);
    const selection = selectionFromOffsets(
      offset => editor.getPositionAt(offset),
      start,
      end,
      text
    );
    if (!selection) {
      return null;
    }

    const destination = this._resolveDestination();
    if (
      destination &&
      !destination.isVisible &&
      action.revealsDestination !== false
    ) {
      this._reveal(destination);
    }
    this._onDismissed();
    return {
      path: widget.context.path,
      cellId: (widget.content as Notebook).activeCell?.model.id,
      selection,
      ...this._destinationContext(destination)
    };
  }

  /**
   * Build the context of the actions from the selection of the watcher.
   *
   * @returns the context, with the editor and the widget it was read from, or
   * `null` if the selection cannot be located in a document.
   */
  context(): SelectionPopupController.ISource | null {
    const selection = this._watcher.selection;
    if (!selection) {
      return null;
    }
    const widget = this._getWidget(selection.widgetId);
    if (!widget) {
      return null;
    }
    // The selection of the watcher can belong to a cell that is not the active
    // one for up to 200 ms: do not use the active cell.
    const editor = selection.cellId
      ? (widget.content as Notebook).widgets.find(
          cell => cell.model.id === selection.cellId
        )?.editor
      : this._getEditor(widget);
    if (!editor) {
      return null;
    }

    try {
      const from = editor.getOffsetAt(selection.start);
      const to = editor.getOffsetAt(selection.end);
      if (
        editor.model.sharedModel.getSource().slice(from, to) !== selection.text
      ) {
        return null;
      }
      const snippet = selectionFromOffsets(
        offset => editor.getPositionAt(offset),
        from,
        to,
        selection.text
      );
      if (!snippet) {
        return null;
      }
      const destination = this._resolveDestination();
      return {
        context: {
          path: widget.context.path,
          cellId: selection.cellId,
          selection: snippet,
          ...this._destinationContext(destination)
        },
        editor,
        widget
      };
    } catch {
      // The selection is stale: the editor was edited since the watcher
      // polled it, and CodeMirror throws for a position out of the document.
      return null;
    }
  }

  /**
   * Dispose the controller.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._isEnabled = () => false;
    this.update();
    if (this._frame) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }
  }

  /**
   * The part of a context that comes from the destination chat. With no chat,
   * it carries the way to open one, if the host provides it.
   */
  private _destinationContext(
    destination: IChatPanel | null
  ): Pick<SelectionActionContext, 'inputModel' | 'chatModel' | 'openNewChat'> {
    return {
      inputModel: destination?.model.input ?? null,
      chatModel: destination?.model ?? null,
      openNewChat: destination ? undefined : this._openNewChat
    };
  }

  /**
   * Show the popup next to the selection of the watcher, or hide it.
   */
  private _show(): void {
    const selection = this._watcher.selection;
    if (!selection) {
      this._popup.context = null;
      return;
    }
    // Dismissed by the user: show it again only for another selection.
    if (this._dismissed && selectionsEqual(this._dismissed, selection)) {
      return;
    }
    // Wait for the end of the drag: the pointer up shows it.
    if (this._pressed) {
      return;
    }
    const source = this.context();
    if (!source) {
      this._popup.context = null;
      return;
    }
    try {
      this._popup.context = source.context;
      this._popup.placeAt(
        source.editor.getCoordinateForPosition(selection.end),
        source.widget.content.node.getBoundingClientRect()
      );
    } catch {
      this._popup.context = null;
    }
  }

  private _onSelectionChanged(
    _: ISelectionWatcher,
    selection: SelectionWatcher.Selection | null
  ): void {
    if (this._dismissed && !selectionsEqual(this._dismissed, selection)) {
      this._dismissed = null;
    }
    this._show();
  }

  private _onDismissed(): void {
    this._dismissed = this._watcher.selection;
    this._popup.context = null;
  }

  private _onPointerDown = (event: PointerEvent): void => {
    this._pressed = true;
    this._pressTarget = event.target as Node | null;
  };

  private _onPointerCancel = (): void => {
    // A lost pointer-up would leave the press flag set, blocking later shows.
    this._pressed = false;
    this._pressTarget = null;
  };

  private _onPointerUp = (): void => {
    const target = this._pressTarget;
    this._pressed = false;
    this._pressTarget = null;

    // Only a selection made in the document can show the popup.
    const selection = this._watcher.selection;
    const widget = selection && this._getWidget(selection.widgetId);
    if (!target || !widget || !widget.node.contains(target)) {
      return;
    }
    // The watcher can still hold the selection that a click has just collapsed.
    const editor = this._getEditor(widget);
    const collapsed =
      !editor ||
      editor.getOffsetAt(editor.getSelection().start) ===
        editor.getOffsetAt(editor.getSelection().end);
    if (collapsed) {
      this._popup.context = null;
      return;
    }
    this._show();
  };

  private _document: Document;
  private _watcher: ISelectionWatcher;
  private _popup: ISelectionPopup;
  private _getEditor: SelectionPopupController.IOptions['getEditor'];
  private _getWidget: SelectionPopupController.IOptions['getWidget'];
  private _resolveDestination: SelectionPopupController.IOptions['resolveDestination'];
  private _reveal: SelectionPopupController.IOptions['reveal'];
  private _openNewChat: SelectionPopupController.IOptions['openNewChat'];
  private _isEnabled: SelectionPopupController.IOptions['isEnabled'];
  private _listening = false;
  private _disposed = false;
  private _pressed = false;
  private _pressTarget: Node | null = null;
  private _dismissed: SelectionWatcher.Selection | null = null;
  private _frame = 0;
}

export namespace SelectionPopupController {
  export interface IOptions {
    /**
     * The document to listen to the pointer on.
     */
    document: Document;
    /**
     * The selection watcher.
     */
    watcher: ISelectionWatcher;
    /**
     * The popup.
     */
    popup: ISelectionPopup;
    /**
     * Get the editor of a document widget (the active cell for a notebook).
     */
    getEditor: typeof getEditor;
    /**
     * Find the document widget of a selection by its ID.
     */
    getWidget: (id: string) => DocumentWidget | null;
    /**
     * Find the chat the actions apply to.
     */
    resolveDestination: () => IChatPanel | null;
    /**
     * Reveal a chat that is not visible.
     */
    reveal: (destination: IChatPanel) => void;
    /**
     * Create and open a chat when there is none, if the host can. Given to the
     * actions in their context only while there is no chat.
     */
    openNewChat?: () => Promise<IChatModel | null>;
    /**
     * Whether the popup is enabled by the settings.
     */
    isEnabled: () => boolean;
  }

  /**
   * A context together with the editor and the widget it was read from.
   */
  export interface ISource {
    context: SelectionActionContext;
    editor: IEditor;
    widget: DocumentWidget;
  }
}
