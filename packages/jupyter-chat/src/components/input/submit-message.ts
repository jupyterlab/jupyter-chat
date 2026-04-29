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
  const {
    model,
    chatCommandRegistry,
    clearInputBeforeSend = false,
    focusInputAfterSend = false
  } = options;

  await chatCommandRegistry?.onSubmit(model);

  const body = model.value;

  if (clearInputBeforeSend) {
    model.value = '';
  }

  model.send(body);

  if (focusInputAfterSend) {
    model.focus();
  }
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
     * Whether to clear the visible input before calling `model.send()`.
     *
     * This preserves existing button-send behavior for any `onSend()`
     * implementation that reads `model.value` directly.
     */
    clearInputBeforeSend?: boolean;
    /**
     * Whether to request input focus after sending.
     */
    focusInputAfterSend?: boolean;
  }
}
