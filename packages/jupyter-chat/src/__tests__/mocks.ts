/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

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
