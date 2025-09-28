/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PromiseDelegate } from '@lumino/coreutils';
import React, { forwardRef, useEffect, useState } from 'react';

import { MessageRenderer } from './message-renderer';
import { BaseMessageProps } from './messages';
import { AttachmentPreviewList } from '../attachments';
import { ChatInput } from '../input';
import { IInputModel, InputModel } from '../../input-model';
import { IChatMessage } from '../../types';
import { replaceSpanToMention } from '../../utils';

/**
 * The message component props.
 */
type ChatMessageProps = BaseMessageProps & {
  /**
   * The message to display.
   */
  message: IChatMessage;
  /**
   * The index of the message in the list.
   */
  index: number;
  /**
   * The promise to resolve when the message is rendered.
   */
  renderedPromise: PromiseDelegate<void>;
};

/**
 * The message component body.
 */
export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  (props, ref): JSX.Element => {
    const { message, model, rmRegistry } = props;
    const [edit, setEdit] = useState<boolean>(false);
    const [deleted, setDeleted] = useState<boolean>(false);
    const [canEdit, setCanEdit] = useState<boolean>(false);
    const [canDelete, setCanDelete] = useState<boolean>(false);

    // Look if the message can be deleted or edited.
    useEffect(() => {
      // Init canDelete and canEdit state.
      setDeleted(message.deleted ?? false);
      if (model.user !== undefined && !message.deleted) {
        if (model.user.username === message.sender.username) {
          setCanEdit(model.updateMessage !== undefined);
          setCanDelete(model.deleteMessage !== undefined);
          return;
        }
        if (message.sender.bot) {
          setCanDelete(model.deleteMessage !== undefined);
        }
      } else {
        setCanEdit(false);
        setCanDelete(false);
      }
    }, [model, message]);

    // Create an input model only if the message is edited.
    const startEdition = (): void => {
      if (!canEdit) {
        return;
      }
      let body = message.body;
      message.mentions?.forEach(user => {
        body = replaceSpanToMention(body, user);
      });
      const inputModel = new InputModel({
        chatContext: model.createChatContext(),
        onSend: (input: string, model?: IInputModel) =>
          updateMessage(message.id, input, model),
        onCancel: () => cancelEdition(),
        value: body,
        activeCellManager: model.activeCellManager,
        selectionWatcher: model.selectionWatcher,
        documentManager: model.documentManager,
        config: {
          sendWithShiftEnter: model.config.sendWithShiftEnter
        },
        attachments: message.attachments,
        mentions: message.mentions
      });
      model.addEditionModel(message.id, inputModel);
      setEdit(true);
    };

    // Cancel the current edition of the message.
    const cancelEdition = (): void => {
      model.getEditionModel(message.id)?.dispose();
      setEdit(false);
    };

    // Update the content of the message.
    const updateMessage = (
      id: string,
      input: string,
      inputModel?: IInputModel
    ): void => {
      if (!canEdit || !inputModel) {
        return;
      }
      // Update the message
      const updatedMessage = { ...message };
      updatedMessage.body = input;
      updatedMessage.attachments = inputModel.attachments;
      updatedMessage.mentions = inputModel.mentions;
      model.updateMessage!(id, updatedMessage);
      model.getEditionModel(message.id)?.dispose();
      setEdit(false);
    };

    // Delete the message.
    const deleteMessage = (id: string): void => {
      if (!canDelete) {
        return;
      }
      model.deleteMessage!(id);
    };

    // Empty if the message has been deleted.
    return deleted ? (
      <div ref={ref} data-index={props.index}></div>
    ) : (
      <div ref={ref} data-index={props.index}>
        {edit && canEdit && model.getEditionModel(message.id) ? (
          <div
            className="jp-chat-input-container"
            data-input-id={model.getEditionModel(message.id)!.id}
          >
            <ChatInput
              onCancel={() => cancelEdition()}
              model={model.getEditionModel(message.id)!}
              chatCommandRegistry={props.chatCommandRegistry}
              toolbarRegistry={props.inputToolbarRegistry}
            />
          </div>
        ) : (
          <MessageRenderer
            rmRegistry={rmRegistry}
            markdownStr={message.body}
            model={model}
            edit={canEdit ? startEdition : undefined}
            delete={canDelete ? () => deleteMessage(message.id) : undefined}
            rendered={props.renderedPromise}
          />
        )}
        {message.attachments && !edit && (
          // Display the attachments only if message is not edited, otherwise the
          // input component display them.
          <AttachmentPreviewList attachments={message.attachments} />
        )}
      </div>
    );
  }
);
