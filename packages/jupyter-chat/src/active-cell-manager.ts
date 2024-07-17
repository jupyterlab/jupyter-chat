/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { JupyterFrontEnd, LabShell } from '@jupyterlab/application';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { IError as CellError } from '@jupyterlab/nbformat';
import { ISignal, Signal } from '@lumino/signaling';

type CellContent = {
  type: string;
  source: string;
};

type CellWithErrorContent = {
  type: 'code';
  source: string;
  error: {
    name: string;
    value: string;
    traceback: string[];
  };
};

export interface IActiveCellManager {
  /**
   * Whether the notebook is available and an active cell exists.
   */
  readonly available: boolean;
  /**
   * The `CellError` output within the active cell, if any.
   */
  readonly activeCellError: CellError | null;
  /**
   * A signal emitting when the active cell changed.
   */
  readonly availabilityChanged: ISignal<this, boolean>;
  /**
   * A signal emitting when the error state of the active cell changed.
   */
  readonly activeCellErrorChanged: ISignal<this, CellError | null>;
  /**
   * Returns an `ActiveCellContent` object that describes the current active
   * cell. If no active cell exists, this method returns `null`.
   *
   * When called with `withError = true`, this method returns `null` if the
   * active cell does not have an error output. Otherwise it returns an
   * `ActiveCellContentWithError` object that describes both the active cell and
   * the error output.
   */
  getContent(withError: boolean): CellContent | CellWithErrorContent | null;
  /**
   * Inserts `content` in a new cell above the active cell.
   */
  insertAbove(content: string): void;
  /**
   * Inserts `content` in a new cell below the active cell.
   */
  insertBelow(content: string): void;
  /**
   * Replaces the contents of the active cell.
   */
  replace(content: string): Promise<void>;
}

/**
 * The active cell manager namespace.
 */
export namespace ActiveCellManager {
  /**
   * The constructor options.
   */
  export interface IOptions {
    /**
     * The notebook tracker.
     */
    tracker: INotebookTracker;
    /**
     * The current shell of the application.
     */
    shell: JupyterFrontEnd.IShell;
  }
}

/**
 * A manager that maintains a reference to the current active notebook cell in
 * the main panel (if any), and provides methods for inserting or appending
 * content to the active cell.
 *
 * The current active cell should be obtained by listening to the
 * `activeCellChanged` signal.
 */
export class ActiveCellManager implements IActiveCellManager {
  constructor(options: ActiveCellManager.IOptions) {
    this._notebookTracker = options.tracker;
    this._notebookTracker.activeCellChanged.connect(this._onActiveCellChanged);
    options.shell.currentChanged?.connect(this._onMainAreaChanged);
    if (options.shell instanceof LabShell) {
      options.shell.layoutModified?.connect(this._onMainAreaChanged);
    }
    this._onMainAreaChanged();
  }

  /**
   * Whether the notebook is available and an active cell exists.
   */
  get available(): boolean {
    return this._available;
  }

  /**
   * The `CellError` output within the active cell, if any.
   */
  get activeCellError(): CellError | null {
    return this._activeCellError;
  }

  /**
   * A signal emitting when the active cell changed.
   */
  get availabilityChanged(): ISignal<this, boolean> {
    return this._availabilityChanged;
  }

  /**
   * A signal emitting when the error state of the active cell changed.
   */
  get activeCellErrorChanged(): ISignal<this, CellError | null> {
    return this._activeCellErrorChanged;
  }

  /**
   * Returns an `ActiveCellContent` object that describes the current active
   * cell. If no active cell exists, this method returns `null`.
   *
   * When called with `withError = true`, this method returns `null` if the
   * active cell does not have an error output. Otherwise it returns an
   * `ActiveCellContentWithError` object that describes both the active cell and
   * the error output.
   */
  getContent(withError: false): CellContent | null;
  getContent(withError: true): CellWithErrorContent | null;
  getContent(withError = false): CellContent | CellWithErrorContent | null {
    const sharedModel = this._notebookTracker.activeCell?.model.sharedModel;
    if (!sharedModel) {
      return null;
    }

    // case where withError = false
    if (!withError) {
      return {
        type: sharedModel.cell_type,
        source: sharedModel.getSource()
      };
    }

    // case where withError = true
    const error = this._activeCellError;
    if (error) {
      return {
        type: 'code',
        source: sharedModel.getSource(),
        error: {
          name: error.ename,
          value: error.evalue,
          traceback: error.traceback
        }
      };
    }

    return null;
  }

  /**
   * Inserts `content` in a new cell above the active cell.
   */
  insertAbove(content: string): void {
    const notebookPanel = this._notebookTracker.currentWidget;
    if (!notebookPanel || !notebookPanel.isVisible) {
      return;
    }

    // create a new cell above the active cell and mark new cell as active
    NotebookActions.insertAbove(notebookPanel.content);
    // replace content of this new active cell
    this.replace(content);
  }

  /**
   * Inserts `content` in a new cell below the active cell.
   */
  insertBelow(content: string): void {
    const notebookPanel = this._notebookTracker.currentWidget;
    if (!notebookPanel || !notebookPanel.isVisible) {
      return;
    }

    // create a new cell below the active cell and mark new cell as active
    NotebookActions.insertBelow(notebookPanel.content);
    // replace content of this new active cell
    this.replace(content);
  }

  /**
   * Replaces the contents of the active cell.
   */
  async replace(content: string): Promise<void> {
    const notebookPanel = this._notebookTracker.currentWidget;
    if (!notebookPanel || !notebookPanel.isVisible) {
      return;
    }
    // get reference to active cell directly from Notebook API. this avoids the
    // possibility of acting on an out-of-date reference.
    const activeCell = this._notebookTracker.activeCell;
    if (!activeCell) {
      return;
    }

    // wait for editor to be ready
    await activeCell.ready;

    // replace the content of the active cell
    /**
     * NOTE: calling this method sometimes emits an error to the browser console:
     *
     * ```
     * Error: Calls to EditorView.update are not allowed while an update is in progress
     * ```
     *
     * However, there seems to be no impact on the behavior/stability of the
     * JupyterLab application after this error is logged. Furthermore, this is
     * the official API for setting the content of a cell in JupyterLab 4,
     * meaning that this is likely unavoidable.
     */
    activeCell.editor?.model.sharedModel.setSource(content);
  }

  private _onMainAreaChanged = () => {
    const value = this._notebookTracker.currentWidget?.isVisible ?? false;
    if (value !== this._notebookVisible) {
      this._notebookVisible = value;
      this._available = !!this._activeCell && this._notebookVisible;
      this._availabilityChanged.emit(this._available);
    }
  };

  /**
   * Handle the change of active notebook cell.
   */
  private _onActiveCellChanged = (
    _: INotebookTracker,
    activeCell: Cell<ICellModel> | null
  ): void => {
    if (this._activeCell !== activeCell) {
      this._activeCell?.model.stateChanged.disconnect(this._cellStateChange);
      this._activeCell = activeCell;
      activeCell?.ready.then(() => {
        this._activeCell?.model.stateChanged.connect(this._cellStateChange);
        this._available = !!this._activeCell && this._notebookVisible;
        this._availabilityChanged.emit(this._available);
      });
    }
  };

  /**
   * Handle the change of the active cell state.
   */
  private _cellStateChange = (
    _: ICellModel,
    change: IChangedArgs<boolean, boolean, any>
  ): void => {
    if (change.name === 'executionCount') {
      const currSharedModel = this._activeCell?.model.sharedModel;
      const prevActiveCellError = this._activeCellError;
      let currActiveCellError: CellError | null = null;
      if (currSharedModel && 'outputs' in currSharedModel) {
        currActiveCellError =
          currSharedModel.outputs.find<CellError>(
            (output): output is CellError => output.output_type === 'error'
          ) || null;
      }

      // for some reason, the `CellError` object is not referentially stable,
      // meaning that this condition always evaluates to `true` and the
      // `activeCellErrorChanged` signal is emitted every 200ms, even when the
      // error output is unchanged. this is why we have to rely on
      // `execution_count` to track changes to the error output.
      if (prevActiveCellError !== currActiveCellError) {
        this._activeCellError = currActiveCellError;
        this._activeCellErrorChanged.emit(this._activeCellError);
      }
    }
  };

  /**
   * The notebook tracker.
   */
  private _notebookTracker: INotebookTracker;
  /**
   * Whether the current notebook panel is visible or not.
   */
  private _notebookVisible: boolean = false;
  /**
   * The active cell.
   */
  private _activeCell: Cell | null = null;
  private _available: boolean = false;
  private _activeCellError: CellError | null = null;
  private _availabilityChanged = new Signal<this, boolean>(this);
  private _activeCellErrorChanged = new Signal<this, CellError | null>(this);
}
