/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ReactWidget } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import React from 'react';
import { Message } from '@lumino/messaging';
import { Drag } from '@lumino/dragdrop';

import { Chat, IInputToolbarRegistry } from '../components';
import { chatIcon } from '../icons';
import { IChatModel } from '../model';
import {
  IFileAttachment,
  INotebookAttachment,
  INotebookAttachmentCell
} from '../types';
import { ActiveCellManager } from '../active-cell-manager';

// MIME type constant for file browser drag events
const FILE_BROWSER_MIME = 'application/x-jupyter-icontentsrich';

// MIME type constant for Notebook cell drag events
const NOTEBOOK_CELL_MIME = 'application/vnd.jupyter.cells';

// CSS class constants
const INPUT_CONTAINER_CLASS = 'jp-chat-input-container';
const DRAG_HOVER_CLASS = 'jp-chat-drag-hover';

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
        this._handleDrag(event as Drag.Event);
        break;
      case 'lm-drop':
        this._handleDrop(event as Drag.Event);
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
  private _handleDrag(event: Drag.Event): void {
    const inputContainer = this.node.querySelector(`.${INPUT_CONTAINER_CLASS}`);
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
      !inputContainer.classList.contains(DRAG_HOVER_CLASS)
    ) {
      inputContainer.classList.add(DRAG_HOVER_CLASS);
      this._dragTarget = inputContainer as HTMLElement;
    }
  }

  /**
   * Check if we can handle the drop
   */
  private _canHandleDrop(event: Drag.Event): boolean {
    const types = event.mimeData.types();
    return (
      types.includes(NOTEBOOK_CELL_MIME) || types.includes(FILE_BROWSER_MIME)
    );
  }

  /**
   * Handle drop events
   */
  private _handleDrop(event: Drag.Event): void {
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
  private _processFileDrop(event: Drag.Event): void {
    try {
      const data = event.mimeData.getData(FILE_BROWSER_MIME) as any;

      if (data?.model?.path) {
        const attachment: IFileAttachment = {
          type: 'file',
          value: data.model.path,
          mimetype: data.model.mimetype
        };
        this.model.input.addAttachment?.(attachment);
      } else {
        console.warn('Invalid file browser data in drop event');
      }
    } catch (error) {
      console.error('Failed to process file drop:', error);
    }
  }

  /**
   * Process dropped cells
   */
  private _processCellDrop(event: Drag.Event): void {
    try {
      const cellData = event.mimeData.getData(NOTEBOOK_CELL_MIME) as any;

      // Cells might come as array or single object
      const cells = Array.isArray(cellData) ? cellData : [cellData];

      const validCells: INotebookAttachmentCell[] = [];
      let notebookPath: string | null = null;

      for (const cell of cells) {
        if (!cell?.id) {
          console.warn('Dropped cell missing ID, skipping');
          continue;
        }

        const cellInfo = this._findNotebookAndCellInfo({ id: cell.id } as Cell);

        if (!cellInfo) {
          console.warn(`Cannot find notebook for cell ${cell.id}, skipping`);
          continue;
        }

        if (notebookPath === null) {
          notebookPath = cellInfo.notebookPath;
        } else if (notebookPath !== cellInfo.notebookPath) {
          console.warn(
            `Mixed notebooks detected, skipping cell ${cell.id} from ${cellInfo.notebookPath}`
          );
          continue;
        }

        const notebookCell: INotebookAttachmentCell = {
          id: cell.id,
          input_type: cell.cell_type || 'code'
        };
        validCells.push(notebookCell);
      }

      // Create single attachment with all cells from the notebook
      if (validCells.length && notebookPath) {
        const attachment: INotebookAttachment = {
          type: 'notebook',
          value: notebookPath,
          cells: validCells
        };
        this.model.input.addAttachment?.(attachment);
      }
    } catch (error) {
      console.error('Failed to process cell drop: ', error);
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
      this._dragTarget.classList.remove(DRAG_HOVER_CLASS);
      this._dragTarget = null;
    }
  }

  private _chatOptions: Chat.IOptions;
  private _dragTarget: HTMLElement | null = null;
}
