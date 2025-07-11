/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { PromiseDelegate } from '@lumino/coreutils';
import { Box } from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useState, useRef } from 'react';

import { MessageFooterComponent } from './footer';
import { ChatMessageHeader } from './header';
import { ChatMessage } from './message';
import { Navigation } from './navigation';
import { WelcomeMessage } from './welcome';
import { WritingUsersList } from './writers';
import { IInputToolbarRegistry } from '../input';
import { ScrollContainer } from '../scroll-container';
import { IChatCommandRegistry, IMessageFooterRegistry } from '../../registers';
import { IChatModel } from '../../model';
import { IChatMessage, IUser } from '../../types';

const MESSAGES_BOX_CLASS = 'jp-chat-messages-container';
const MESSAGE_CLASS = 'jp-chat-message';
const MESSAGE_STACKED_CLASS = 'jp-chat-message-stacked';

/**
 * The base components props.
 */
export type BaseMessageProps = {
  /**
   * The mime renderer registry.
   */
  rmRegistry: IRenderMimeRegistry;
  /**
   * The chat model.
   */
  model: IChatModel;
  /**
   * The chat commands registry.
   */
  chatCommandRegistry?: IChatCommandRegistry;
  /**
   * The input toolbar registry.
   */
  inputToolbarRegistry: IInputToolbarRegistry;
  /**
   * The footer registry.
   */
  messageFooterRegistry?: IMessageFooterRegistry;
  /**
   * The welcome message.
   */
  welcomeMessage?: string;
};

/**
 * The messages list component.
 */
export function ChatMessages(props: BaseMessageProps): JSX.Element {
  const { model } = props;
  const [messages, setMessages] = useState<IChatMessage[]>(model.messages);
  const refMsgBox = useRef<HTMLDivElement>(null);
  const [currentWriters, setCurrentWriters] = useState<IUser[]>([]);
  const [allRendered, setAllRendered] = useState<boolean>(false);

  // The list of message DOM and their rendered promises.
  const listRef = useRef<(HTMLDivElement | null)[]>([]);
  const renderedPromise = useRef<PromiseDelegate<void>[]>([]);

  /**
   * Effect: fetch history and config on initial render
   */
  useEffect(() => {
    async function fetchHistory() {
      if (!model.getHistory) {
        return;
      }
      model
        .getHistory()
        .then(history => setMessages(history.messages))
        .catch(e => console.error(e));
    }

    fetchHistory();
    setCurrentWriters([]);
  }, [model]);

  /**
   * Effect: listen to chat messages.
   */
  useEffect(() => {
    function handleChatEvents() {
      setMessages([...model.messages]);
    }

    function handleWritersChange(_: IChatModel, writers: IChatModel.IWriter[]) {
      setCurrentWriters(writers.map(writer => writer.user));
    }

    model.messagesUpdated.connect(handleChatEvents);
    model.writersChanged?.connect(handleWritersChange);

    return function cleanup() {
      model.messagesUpdated.disconnect(handleChatEvents);
      model.writersChanged?.disconnect(handleChatEvents);
    };
  }, [model]);

  /**
   * Observe the messages to update the current viewport and the unread messages.
   */
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      // Used on first rendering, to ensure all the message as been rendered once.
      if (!allRendered) {
        const activePromises = renderedPromise.current
          // Filter out nulls signifying deleted messages
          .filter(p => p)
          .map(p => p.promise);

        Promise.all(activePromises).then(() => {
          setAllRendered(true);
        });
      }

      const unread = [...model.unreadMessages];
      let unreadModified = false;
      const inViewport = [...(model.messagesInViewport ?? [])];
      entries.forEach(entry => {
        const index = parseInt(entry.target.getAttribute('data-index') ?? '');
        if (!isNaN(index)) {
          const viewportIdx = inViewport.indexOf(index);
          if (!entry.isIntersecting && viewportIdx !== -1) {
            inViewport.splice(viewportIdx, 1);
          } else if (entry.isIntersecting && viewportIdx === -1) {
            inViewport.push(index);
          }
          if (unread.length) {
            const unreadIdx = unread.indexOf(index);
            if (unreadIdx !== -1 && entry.isIntersecting) {
              unread.splice(unreadIdx, 1);
              unreadModified = true;
            }
          }
        }
      });

      props.model.messagesInViewport = inViewport;

      // Ensure that all messages are rendered before updating unread messages, otherwise
      // it can lead to wrong assumption , because more message are in the viewport
      // before they are rendered.
      if (allRendered && unreadModified) {
        model.unreadMessages = unread;
      }
    });

    /**
     * Observe the messages.
     */
    listRef.current.forEach(item => {
      if (item) {
        observer.observe(item);
      }
    });

    return () => {
      listRef.current.forEach(item => {
        if (item) {
          observer.unobserve(item);
        }
      });
    };
  }, [messages, allRendered]);

  return (
    <>
      <ScrollContainer sx={{ flexGrow: 1 }}>
        {props.welcomeMessage && (
          <WelcomeMessage
            rmRegistry={props.rmRegistry}
            content={props.welcomeMessage}
          />
        )}
        <Box ref={refMsgBox} className={clsx(MESSAGES_BOX_CLASS)}>
          {messages.map((message, i) => {
            // Skip rendering deleted messages while preventing sparse array
            if (message.deleted) {
              listRef.current[i] = null;
              return null;
            }
            renderedPromise.current[i] = new PromiseDelegate();
            return (
              // extra div needed to ensure each bubble is on a new line
              <Box
                key={i}
                className={clsx(
                  MESSAGE_CLASS,
                  message.stacked ? MESSAGE_STACKED_CLASS : ''
                )}
              >
                <ChatMessageHeader message={message} />
                <ChatMessage
                  {...props}
                  message={message}
                  index={i}
                  renderedPromise={renderedPromise.current[i]}
                  ref={el => (listRef.current[i] = el)}
                />
                {props.messageFooterRegistry && (
                  <MessageFooterComponent
                    registry={props.messageFooterRegistry}
                    message={message}
                    model={model}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </ScrollContainer>
      <WritingUsersList writers={currentWriters}></WritingUsersList>
      <Navigation {...props} refMsgBox={refMsgBox} allRendered={allRendered} />
    </>
  );
}
