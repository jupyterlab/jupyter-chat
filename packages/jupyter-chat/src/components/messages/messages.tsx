/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PromiseDelegate } from '@lumino/coreutils';
import { Box } from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useState, useRef } from 'react';

import { MessageFooterComponent } from './footer';
import { ChatMessageHeader } from './header';
import { ChatMessage } from './message';
import { MessagePreambleComponent } from './preamble';
import { Navigation } from './navigation';
import { WelcomeMessage } from './welcome';
import { ScrollContainer } from '../scroll-container';
import { useChatContext } from '../../context';
import { Message } from '../../message';
import { IChatModel } from '../../model';
import { IMessage, IConfig } from '../../types';

export const MESSAGE_CLASS = 'jp-chat-message';
const MESSAGES_BOX_CLASS = 'jp-chat-messages-container';
const MESSAGE_STACKED_CLASS = 'jp-chat-message-stacked';

/**
 * The messages list component.
 */
export function ChatMessages(): JSX.Element {
  const {
    area,
    messageFooterRegistry,
    messagePreambleRegistry,
    model,
    welcomeMessage
  } = useChatContext();

  const [messages, setMessages] = useState<IMessage[]>(model.messages);
  const refMsgBox = useRef<HTMLDivElement>(null);
  const [allRendered, setAllRendered] = useState<boolean>(false);
  const [showDeleted, setShowDeleted] = useState<boolean>(
    model.config.showDeleted ?? false
  );

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
        .then(history =>
          setMessages(
            history.messages.map(message => new Message({ ...message }))
          )
        )
        .catch(e => console.error(e));
    }

    fetchHistory();
  }, [model]);

  /**
   * Effect: listen to chat messages.
   */
  useEffect(() => {
    function handleChatEvents() {
      setMessages([...model.messages]);
    }
    model.messagesUpdated.connect(handleChatEvents);

    return () => {
      model.messagesUpdated.disconnect(handleChatEvents);
    };
  }, [model]);

  /**
   * Effect: Listen to the config change.
   */
  useEffect(() => {
    function handleConfigChange(_: IChatModel, config: IConfig) {
      if (config.showDeleted !== showDeleted) {
        setShowDeleted(config.showDeleted ?? false);
      }
    }
    model.configChanged.connect(handleConfigChange);

    return () => {
      model.configChanged.disconnect(handleConfigChange);
    };
  }, [model, showDeleted]);

  /**
   * Observe the messages to update the current viewport and the unread messages.
   */
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      // Used on first rendering, to ensure all the message as been rendered once.
      if (!allRendered) {
        Promise.all(renderedPromise.current.map(p => p.promise)).then(() => {
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

      model.messagesInViewport = inViewport;

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

  const horizontalPadding = area === 'main' ? 8 : 4;
  return (
    <>
      <ScrollContainer sx={{ flexGrow: 1 }}>
        {welcomeMessage && <WelcomeMessage content={welcomeMessage} />}
        <Box
          sx={{
            paddingLeft: horizontalPadding,
            paddingRight: horizontalPadding,
            paddingTop: 4,
            paddingBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
          ref={refMsgBox}
          className={clsx(MESSAGES_BOX_CLASS)}
        >
          {/* Filter the deleted message if user don't expect to see it. */}
          {(showDeleted
            ? messages
            : messages.filter(message => !message.deleted)
          ).map((message, i) => {
            renderedPromise.current[i] = new PromiseDelegate();
            const isCurrentUser =
              model.user !== undefined &&
              model.user.username === message.sender.username;
            return (
              // extra div needed to ensure each bubble is on a new line
              <Box
                key={message.id}
                sx={{
                  ...(isCurrentUser && {
                    marginLeft: area === 'main' ? '25%' : '10%',
                    backgroundColor: 'var(--jp-layout-color2)',
                    border: 'none',
                    borderRadius: 2,
                    padding: 2
                  })
                }}
                className={clsx(
                  MESSAGE_CLASS,
                  message.stacked ? MESSAGE_STACKED_CLASS : ''
                )}
              >
                <ChatMessageHeader
                  message={message}
                  isCurrentUser={isCurrentUser}
                />
                {messagePreambleRegistry && (
                  <MessagePreambleComponent message={message} />
                )}
                <ChatMessage
                  message={message}
                  index={i}
                  renderedPromise={renderedPromise.current[i]}
                  ref={el => (listRef.current[i] = el)}
                />
                {messageFooterRegistry && (
                  <MessageFooterComponent message={message} />
                )}
              </Box>
            );
          })}
        </Box>
      </ScrollContainer>
      <Navigation refMsgBox={refMsgBox} allRendered={allRendered} />
    </>
  );
}
