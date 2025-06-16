/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { JupyterFrontEnd } from '@jupyterlab/application';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  EditorLanguageRegistry,
  IEditorLanguageRegistry
} from '@jupyterlab/codemirror';
import { Notebook } from '@jupyterlab/notebook';

import { find } from '@lumino/algorithm';
import { Widget } from '@lumino/widgets';
import { ISignal, Signal } from '@lumino/signaling';

import { getCellIndex, getEditor } from './utils';

/**
 * The selection watcher namespace.
 */
export namespace SelectionWatcher {
  /**
   * The constructor options.
   */
  export interface IOptions {
    /**
     * The current shell of the application.
     */
    shell: JupyterFrontEnd.IShell;
    /**
     * Editor language registry.
     */
    languages?: IEditorLanguageRegistry;
  }

  /**
   * The selection type.
   */
  export type Selection = CodeEditor.ITextSelection & {
    /**
     * The text within the selection as a string.
     */
    text: string;
    /**
     * Number of lines contained by the text selection.
     */
    numLines: number;
    /**
     * The ID of the document widget in which the selection was made.
     */
    widgetId: string;
    /**
     * The language of the selection.
     */
    language?: string;
    /**
     * The ID of the cell in which the selection was made, if the original widget
     * was a notebook.
     */
    cellId?: string;
  };
}

/**
 * The selection watcher interface.
 */
export interface ISelectionWatcher {
  readonly selection: SelectionWatcher.Selection | null;
  readonly selectionChanged: ISignal<
    ISelectionWatcher,
    SelectionWatcher.Selection | null
  >;
  replaceSelection(selection: SelectionWatcher.Selection): void;
}

/**
 * The selection watcher, read/write selected text in a DocumentWidget.
 */
export class SelectionWatcher {
  constructor(options: SelectionWatcher.IOptions) {
    this._shell = options.shell;
    this._languages = options.languages || new EditorLanguageRegistry();
    this._shell.currentChanged?.connect((sender, args) => {
      // Do not change the main area widget if the new one has no editor, for example
      // a chat panel. However, the selected text is only available if the main area
      // widget is visible. (to avoid confusion in inclusion/replacement).
      const widget = args.newValue;

      // if there is no main area widget, set it to null.
      if (widget === null) {
        this._mainAreaDocumentWidget = null;
        return;
      }

      const editor = getEditor(widget);
      if (
        widget instanceof DocumentWidget &&
        (editor || widget.content instanceof Notebook)
      ) {
        // if the new widget is a DocumentWidget and has an editor, set it.
        // NOTE: special case for notebook which do not has an active cell at that stage,
        // and so the editor can't be retrieved too.
        this._mainAreaDocumentWidget = widget;
      } else if (this._mainAreaDocumentWidget?.isDisposed) {
        // if the previous document widget has been closed, set it to null.
        this._mainAreaDocumentWidget = null;
      }
    });

    setInterval(this._poll.bind(this), 200);
  }

  get selection(): SelectionWatcher.Selection | null {
    return this._selection;
  }

  get selectionChanged(): ISignal<this, SelectionWatcher.Selection | null> {
    return this._selectionChanged;
  }

  replaceSelection(selection: SelectionWatcher.Selection): void {
    // unfortunately shell.currentWidget doesn't update synchronously after
    // shell.activateById(), which is why we have to get a reference to the
    // widget manually.
    const widget = find(
      this._shell.widgets(),
      widget => widget.id === selection.widgetId
    );
    // Do not allow replacement on non visible widget (to avoid confusion).
    if (!widget?.isVisible || !(widget instanceof DocumentWidget)) {
      return;
    }

    // activate the widget if not already active
    this._shell.activateById(selection.widgetId);

    // activate notebook cell if specified
    if (widget.content instanceof Notebook && selection.cellId) {
      const cellIndex = getCellIndex(widget.content, selection.cellId);
      if (cellIndex !== -1) {
        widget.content.activeCellIndex = cellIndex;
      }
    }

    // get editor instance
    const editor = getEditor(widget);
    if (!editor) {
      return;
    }

    editor.model.sharedModel.updateSource(
      editor.getOffsetAt(selection.start),
      editor.getOffsetAt(selection.end),
      selection.text
    );
    const newPosition = editor.getPositionAt(
      editor.getOffsetAt(selection.start) + selection.text.length
    );
    editor.setSelection({ start: newPosition, end: newPosition });
  }

  protected async _poll(): Promise<void> {
    let currSelection: SelectionWatcher.Selection | null = null;
    const prevSelection = this._selection;
    // Do not return selected text if the main area widget is hidden.
    if (this._mainAreaDocumentWidget?.isVisible) {
      currSelection = await getTextSelection(
        this._mainAreaDocumentWidget,
        this._languages
      );
    }
    if (prevSelection?.text !== currSelection?.text) {
      this._selection = currSelection;
      this._selectionChanged.emit(currSelection);
    }
  }

  protected _shell: JupyterFrontEnd.IShell;
  protected _mainAreaDocumentWidget: Widget | null = null;
  protected _selection: SelectionWatcher.Selection | null = null;
  protected _selectionChanged = new Signal<
    this,
    SelectionWatcher.Selection | null
  >(this);
  private _languages: IEditorLanguageRegistry;
}

/**
 * Gets a Selection object from a document widget. Returns `null` if unable.
 */
async function getTextSelection(
  widget: Widget | null,
  languages: IEditorLanguageRegistry
): Promise<SelectionWatcher.Selection | null> {
  const editor = getEditor(widget);
  // widget type check is redundant but hints the type to TypeScript
  if (!editor || !(widget instanceof DocumentWidget)) {
    return null;
  }

  let cellId: string | undefined = undefined;
  if (widget.content instanceof Notebook) {
    cellId = widget.content.activeCell?.model.id;
  }

  const selectionObj = editor.getSelection();
  let { start, end } = selectionObj;
  const startOffset = editor.getOffsetAt(start);
  const endOffset = editor.getOffsetAt(end);
  const text = editor.model.sharedModel
    .getSource()
    .substring(startOffset, endOffset);

  // Do not return a Selection object if no text is selected
  if (!text) {
    return null;
  }

  // ensure start <= end
  // required for editor.model.sharedModel.updateSource()
  if (startOffset > endOffset) {
    [start, end] = [end, start];
  }

  const language = (await languages.getLanguage(editor?.model.mimeType))?.name;
  return {
    ...selectionObj,
    start,
    end,
    text,
    numLines: text.split('\n').length,
    widgetId: widget.id,

    ...(language && {
      language
    }),
    ...(cellId && {
      cellId
    })
  };
}
