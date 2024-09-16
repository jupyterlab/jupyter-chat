import { JupyterFrontEnd } from '@jupyterlab/application';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { CodeEditor } from '@jupyterlab/codeeditor';
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
    this._shell.currentChanged?.connect((sender, args) => {
      this._mainAreaWidget = args.newValue;
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
    if (!(widget instanceof DocumentWidget)) {
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

  protected _poll(): void {
    const prevSelection = this._selection;
    const currSelection = getTextSelection(this._mainAreaWidget);

    if (prevSelection?.text === currSelection?.text) {
      return;
    }

    this._selection = currSelection;
    this._selectionChanged.emit(currSelection);
  }

  protected _shell: JupyterFrontEnd.IShell;
  protected _mainAreaWidget: Widget | null = null;
  protected _selection: SelectionWatcher.Selection | null = null;
  protected _selectionChanged = new Signal<
    this,
    SelectionWatcher.Selection | null
  >(this);
}

/**
 * Gets a Selection object from a document widget. Returns `null` if unable.
 */
function getTextSelection(
  widget: Widget | null
): SelectionWatcher.Selection | null {
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

  return {
    ...selectionObj,
    start,
    end,
    text,
    numLines: text.split('\n').length,
    widgetId: widget.id,
    ...(cellId && {
      cellId
    })
  };
}
