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
  sendMessage(message: INewMessage): Promise<boolean | void> | boolean | void {
    // No-op
  }

  createChatContext(): IChatContext {
    return new MockChatContext({ model: this });
  }
}
