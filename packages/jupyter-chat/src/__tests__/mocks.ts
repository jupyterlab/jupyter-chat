/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Signal } from '@lumino/signaling';

import { IActiveCellManager } from '../active-cell-manager';
import {
  AbstractChatContext,
  AbstractChatModel,
  IChatModel,
  IChatContext
} from '../model';
import { INewMessage } from '../types';

export class MockChatContext
  extends AbstractChatContext
  implements IChatContext
{
  get users() {
    return [];
  }
}

export class MockChatModel extends AbstractChatModel implements IChatModel {
  sendMessage(message: INewMessage): null {
    // No-op
    return null;
  }

  createChatContext(): IChatContext {
    return new MockChatContext({ model: this });
  }
}

export function createMockActiveCellManager(
  available = false
): IActiveCellManager {
  return {
    available,
    activeCellError: null,
    availabilityChanged: new Signal({} as any),
    activeCellErrorChanged: new Signal({} as any),
    getContent: () => null,
    insertAbove: jest.fn(),
    insertBelow: jest.fn(),
    replace: jest.fn()
  };
}
