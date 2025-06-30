/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactWidget } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import React from 'react';
import { Message } from '@lumino/messaging';
import { IDragEvent } from '@lumino/dragdrop';

import { Chat, IInputToolbarRegistry } from '../components';
import { chatIcon } from '../icons';
import { IChatModel } from '../model';
import { IFileAttachment, ICellAttachment } from '../types';
import { ActiveCellManager } from '../active-cell-manager';

// MIME type constant for file browser drag events
const FILE_BROWSER_MIME = 'application/x-jupyter-icontentsrich';

// MIME type constant for Notebook cell drag events
const NOTEBOOK_CELL_MIME = 'application/vnd.jupyter.cells';

export class ChatWidget extends ReactWidget {
  constructor(options: Chat.IOptions) {
    super();

    this.title.icon = chatIcon;
    this.title.caption = 'Jupyter Chat'; // TODO: i18n

    this._chatOptions = options;
    this.id = `jupyter-chat::widget::${options.model.name}`;
    this.node.onclick = () => this.model.input.focus();
  }

  /**
   * Get the model of the widget.
   */
  get model(): IChatModel {
    return this._chatOptions.model;
  }

  /**
   * Get the input toolbar registry (if it has been provided when creating the widget).
   */
  get inputToolbarRegistry(): IInputToolbarRegistry | undefined {
    return this._chatOptions.inputToolbarRegistry;
  }

  render() {
    // The model need to be passed, otherwise it is undefined in the widget in
    // the case of collaborative document.
    return <Chat {...this._chatOptions} model={this._chatOptions.model} />;
  }

  /**
   * Handle DOM events for drag and drop
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'lm-dragenter':
        event.preventDefault();
        event.stopPropagation();
        break;
      case 'lm-dragover':
        this._handleDrag(event as IDragEvent);
        break;
      case 'lm-drop':
        this._handleDrop(event as IDragEvent);
        break;
      case 'lm-dragleave': {
        // Remove hover class on leaving the widget
        const targetElement = (event as DragEvent).relatedTarget;
        if (!targetElement || !this.node.contains(targetElement as Node)) {
          this._removeDragHoverClass();
        }
        break;
      }
    }
  }

  /**
   * A message handler invoked on an `'after-attach'` message.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.node.addEventListener('lm-dragover', this, true);
    this.node.addEventListener('lm-dragenter', this, true);
    this.node.addEventListener('lm-drop', this, true);
    this.node.addEventListener('lm-dragleave', this, true);
  }

  /**
   * A message handler invoked on a `'before-detach'` message.
   */
  protected onBeforeDetach(msg: Message): void {
    this.node.removeEventListener('lm-dragover', this, true);
    this.node.removeEventListener('lm-dragenter', this, true);
    this.node.removeEventListener('lm-drop', this, true);
    this.node.removeEventListener('lm-dragleave', this, true);
    super.onBeforeDetach(msg);
  }

  /**
   * Handle drag over events
   */
  private _handleDrag(event: IDragEvent): void {
    const inputContainer = this.node.querySelector('.jp-chat-input-container');
    const target = event.target as HTMLElement;
    const isOverInput =
      inputContainer?.contains(target) || inputContainer === target;

    if (!isOverInput) {
      this._removeDragHoverClass();
      return;
    }

    if (!this._canHandleDrop(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dropAction = 'move';

    if (
      inputContainer &&
      !inputContainer.classList.contains('jp-chat-drag-hover')
    ) {
      inputContainer.classList.add('jp-chat-drag-hover');
      this._dragTarget = inputContainer as HTMLElement;
    }
  }

  /**
   * Check if we can handle the drop
   */
  private _canHandleDrop(event: IDragEvent): boolean {
    const types = event.mimeData.types();
    return (
      types.includes(NOTEBOOK_CELL_MIME) || types.includes(FILE_BROWSER_MIME)
    );
  }

  /**
   * Handle drop events
   */
  private _handleDrop(event: IDragEvent): void {
    if (!this._canHandleDrop(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dropAction = 'move';

    this._removeDragHoverClass();

    try {
      if (event.mimeData.hasData(NOTEBOOK_CELL_MIME)) {
        this._processCellDrop(event);
      } else if (event.mimeData.hasData(FILE_BROWSER_MIME)) {
        this._processFileDrop(event);
      }
    } catch (error) {
      console.error('Error processing drop:', error);
    }
  }

  /**
   * Process dropped files
   */
  private _processFileDrop(event: IDragEvent): void {
    const data = event.mimeData.getData(FILE_BROWSER_MIME) as any;

    if (data?.model?.path) {
      const attachment: IFileAttachment = {
        type: 'file',
        value: data.model.path,
        mimeType: data.model.mimetype || undefined
      };
      this.model.input.addAttachment?.(attachment);
    }
  }

  /**
   * Process dropped cells
   */
  private _processCellDrop(event: IDragEvent): void {
    const cellData = event.mimeData.getData(NOTEBOOK_CELL_MIME) as any;

    // Cells might come as array or single object
    const cells = Array.isArray(cellData) ? cellData : [cellData];

    for (const cell of cells) {
      if (cell?.id) {
        const cellInfo = this._findNotebookAndCellInfo(cell);

        if (cellInfo) {
          const attachment: ICellAttachment = {
            type: 'cell',
            value: cell.id,
            cellType: cell.cell_type || 'code',
            notebookPath: cellInfo.notebookPath
          };
          this.model.input.addAttachment?.(attachment);
        }
      }
    }
  }

  /**
   * Find the notebook path for a cell by searching through active and open notebooks
   */
  private _findNotebookAndCellInfo(
    cell: Cell
  ): { notebookPath: string } | null {
    if (this.model.input.activeCellManager) {
      const activeCellManager = this.model.input
        .activeCellManager as ActiveCellManager;
      const notebookTracker = (activeCellManager as any)._notebookTracker;

      if (notebookTracker?.currentWidget) {
        const currentNotebook = notebookTracker.currentWidget;
        const cells = currentNotebook.content.widgets;
        const cellWidget = cells.find((c: Cell) => c.model.id === cell.id);

        if (cellWidget) {
          return {
            notebookPath: currentNotebook.context.path
          };
        }
      }

      // If not in current notebook, check all open notebooks
      if (notebookTracker) {
        const widgets = notebookTracker.widgets || [];
        for (const notebook of widgets) {
          const cells = notebook.content.widgets;
          const cellWidget = cells.find((c: Cell) => c.model.id === cell.id);

          if (cellWidget) {
            return {
              notebookPath: notebook.context.path
            };
          }
        }
      }
    }

    console.warn('Could not find notebook path for cell:', cell.id);
    return null;
  }

  /**
   * Remove drag hover class
   */
  private _removeDragHoverClass(): void {
    if (this._dragTarget) {
      this._dragTarget.classList.remove('jp-chat-drag-hover');
      this._dragTarget = null;
    }
  }

  private _chatOptions: Chat.IOptions;
  private _dragTarget: HTMLElement | null = null;
}
