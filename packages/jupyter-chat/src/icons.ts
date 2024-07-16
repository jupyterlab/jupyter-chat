/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

// This file is based on iconimports.ts in @jupyterlab/ui-components, but is manually generated.

import { LabIcon } from '@jupyterlab/ui-components';

import chatSvgStr from '../style/icons/chat.svg';
import readSvgStr from '../style/icons/read.svg';
import replaceCellSvg from '../style/icons/replace-cell.svg';

export const chatIcon = new LabIcon({
  name: 'jupyter-chat::chat',
  svgstr: chatSvgStr
});

export const readIcon = new LabIcon({
  name: 'jupyter-chat::read',
  svgstr: readSvgStr
});

export const replaceCellIcon = new LabIcon({
  name: 'jupyter-ai::replace-cell',
  svgstr: replaceCellSvg
});
