/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IInputModel } from '../../input-model';
import { IChatCommandRegistry } from '../../registers';

/**
 * Submit the current input value as a chat message.
 */
export async function submitInputMessage(
  options: submitInputMessage.IOptions
): Promise<void> {
  const { model, chatCommandRegistry, body } = options;

  await chatCommandRegistry?.onSubmit(model);

  model.send(body ?? model.value);
  model.focus();
}

export namespace submitInputMessage {
  export interface IOptions {
    /**
     * The input model containing the message to send.
     */
    model: IInputModel;
    /**
     * Optional chat command registry used to preprocess message content.
     */
    chatCommandRegistry?: IChatCommandRegistry;
    /**
     * Optional message body to send instead of the current model value.
     */
    body?: string;
  }
}
