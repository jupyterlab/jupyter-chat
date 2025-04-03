/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Button } from '@jupyter/react-components';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import {
  LabIcon,
  caretDownEmptyIcon,
  classes
} from '@jupyterlab/ui-components';
import { PromiseDelegate } from '@lumino/coreutils';
import { Avatar as MuiAvatar, Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useState, useRef, forwardRef } from 'react';

import { AttachmentPreviewList } from './attachments';
import { ChatInput } from './chat-input';
import { IInputToolbarRegistry } from './input';
import { MarkdownRenderer } from './markdown-renderer';
import { ScrollContainer } from './scroll-container';
import { IChatCommandRegistry } from '../chat-commands';
import { IInputModel, InputModel } from '../input-model';
import { IChatModel } from '../model';
import { IChatMessage, IUser } from '../types';
import { replaceSpanToMention } from '../utils';

const MESSAGES_BOX_CLASS = 'jp-chat-messages-container';
const MESSAGE_CLASS = 'jp-chat-message';
const MESSAGE_STACKED_CLASS = 'jp-chat-message-stacked';
const MESSAGE_HEADER_CLASS = 'jp-chat-message-header';
const MESSAGE_TIME_CLASS = 'jp-chat-message-time';
const WRITERS_CLASS = 'jp-chat-writers';
const NAVIGATION_BUTTON_CLASS = 'jp-chat-navigation';
const NAVIGATION_UNREAD_CLASS = 'jp-chat-navigation-unread';
const NAVIGATION_TOP_CLASS = 'jp-chat-navigation-top';
const NAVIGATION_BOTTOM_CLASS = 'jp-chat-navigation-bottom';

/**
 * The base components props.
 */
type BaseMessageProps = {
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

    function handleWritersChange(_: IChatModel, writers: IUser[]) {
      setCurrentWriters(writers);
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
        <Box ref={refMsgBox} className={clsx(MESSAGES_BOX_CLASS)}>
          {messages.map((message, i) => {
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
              </Box>
            );
          })}
        </Box>
        <Writers writers={currentWriters}></Writers>
      </ScrollContainer>
      <Navigation {...props} refMsgBox={refMsgBox} allRendered={allRendered} />
    </>
  );
}

/**
 * The message header props.
 */
type ChatMessageHeaderProps = {
  /**
   * The chat message.
   */
  message: IChatMessage;
};

/**
 * The message header component.
 */
export function ChatMessageHeader(props: ChatMessageHeaderProps): JSX.Element {
  const [datetime, setDatetime] = useState<Record<number, string>>({});
  const message = props.message;
  const sender = message.sender;
  /**
   * Effect: update cached datetime strings upon receiving a new message.
   */
  useEffect(() => {
    if (!datetime[message.time]) {
      const newDatetime: Record<number, string> = {};
      let datetime: string;
      const currentDate = new Date();
      const sameDay = (date: Date) =>
        date.getFullYear() === currentDate.getFullYear() &&
        date.getMonth() === currentDate.getMonth() &&
        date.getDate() === currentDate.getDate();

      const msgDate = new Date(message.time * 1000); // Convert message time to milliseconds

      // Display only the time if the day of the message is the current one.
      if (sameDay(msgDate)) {
        // Use the browser's default locale
        datetime = msgDate.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        });
      } else {
        // Use the browser's default locale
        datetime = msgDate.toLocaleString([], {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      }
      newDatetime[message.time] = datetime;
      setDatetime(newDatetime);
    }
  });

  const avatar = message.stacked ? null : Avatar({ user: sender });

  const name =
    sender.display_name ?? sender.name ?? (sender.username || 'User undefined');

  return (
    <Box
      className={MESSAGE_HEADER_CLASS}
      sx={{
        display: 'flex',
        alignItems: 'center',
        '& > :not(:last-child)': {
          marginRight: 3
        },
        marginBottom: message.stacked ? '0px' : '12px'
      }}
    >
      {avatar}
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!message.stacked && (
            <Typography
              sx={{
                fontWeight: 700,
                color: 'var(--jp-ui-font-color1)',
                paddingRight: '0.5em'
              }}
            >
              {name}
            </Typography>
          )}
          {(message.deleted || message.edited) && (
            <Typography
              sx={{
                fontStyle: 'italic',
                fontSize: 'var(--jp-content-font-size0)'
              }}
            >
              {message.deleted ? '(message deleted)' : '(edited)'}
            </Typography>
          )}
        </Box>
        <Typography
          className={MESSAGE_TIME_CLASS}
          sx={{
            fontSize: '0.8em',
            color: 'var(--jp-ui-font-color2)',
            fontWeight: 300
          }}
          title={message.raw_time ? 'Unverified time' : ''}
        >
          {`${datetime[message.time]}${message.raw_time ? '*' : ''}`}
        </Typography>
      </Box>
    </Box>
  );
}

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
    const [inputModel, setInputModel] = useState<IInputModel | null>(null);

    // Look if the message can be deleted or edited.
    useEffect(() => {
      setDeleted(message.deleted ?? false);
      if (model.user !== undefined && !message.deleted) {
        if (model.user.username === message.sender.username) {
          setCanEdit(model.updateMessage !== undefined);
          setCanDelete(model.deleteMessage !== undefined);
        }
      } else {
        setCanEdit(false);
        setCanDelete(false);
      }
    }, [model, message]);

    // Create an input model only if the message is edited.
    useEffect(() => {
      if (edit && canEdit) {
        setInputModel(() => {
          let body = message.body;
          message.mentions?.forEach(user => {
            body = replaceSpanToMention(body, user);
          });
          return new InputModel({
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
        });
      } else {
        setInputModel(null);
      }
    }, [edit]);

    // Cancel the current edition of the message.
    const cancelEdition = (): void => {
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
        {edit && canEdit && inputModel ? (
          <ChatInput
            onCancel={() => cancelEdition()}
            model={inputModel}
            chatCommandRegistry={props.chatCommandRegistry}
            toolbarRegistry={props.inputToolbarRegistry}
          />
        ) : (
          <MarkdownRenderer
            rmRegistry={rmRegistry}
            markdownStr={message.body}
            model={model}
            edit={canEdit ? () => setEdit(true) : undefined}
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

/**
 * The writers component props.
 */
type writersProps = {
  /**
   * The list of users currently writing.
   */
  writers: IUser[];
};

/**
 * The writers component, displaying the current writers.
 */
export function Writers(props: writersProps): JSX.Element | null {
  const { writers } = props;
  return writers.length > 0 ? (
    <Box className={WRITERS_CLASS}>
      {writers.map((writer, index) => (
        <div>
          <Avatar user={writer} small />
          <span>
            {writer.display_name ??
              writer.name ??
              (writer.username || 'User undefined')}
          </span>
          <span>
            {index < writers.length - 1
              ? index < writers.length - 2
                ? ', '
                : ' and '
              : ''}
          </span>
        </div>
      ))}
      <span>{(writers.length > 1 ? ' are' : ' is') + ' writing'}</span>
    </Box>
  ) : null;
}

/**
 * The navigation component props.
 */
type NavigationProps = BaseMessageProps & {
  /**
   * The reference to the messages container.
   */
  refMsgBox: React.RefObject<HTMLDivElement>;
  /**
   * Whether all the messages has been rendered once on first display.
   */
  allRendered: boolean;
};

/**
 * The navigation component, to navigate to unread messages.
 */
export function Navigation(props: NavigationProps): JSX.Element {
  const { model } = props;
  const [lastInViewport, setLastInViewport] = useState<boolean>(true);
  const [unreadBefore, setUnreadBefore] = useState<number | null>(null);
  const [unreadAfter, setUnreadAfter] = useState<number | null>(null);

  const gotoMessage = (msgIdx: number, alignToTop: boolean = true) => {
    props.refMsgBox.current?.children.item(msgIdx)?.scrollIntoView(alignToTop);
  };

  // Listen for change in unread messages, and find the first unread message before or
  // after the current viewport, to display navigation buttons.
  useEffect(() => {
    // Do not attempt to display navigation until messages are rendered, it can lead to
    // wrong assumption, because more messages are in the viewport before they are
    // rendered.
    if (!props.allRendered) {
      return;
    }

    const unreadChanged = (model: IChatModel, unreadIndexes: number[]) => {
      const viewport = model.messagesInViewport;
      if (!viewport) {
        return;
      }

      // Initialize the next values with the current values if there still relevant.
      let before =
        unreadBefore !== null &&
        unreadIndexes.includes(unreadBefore) &&
        unreadBefore < Math.min(...viewport)
          ? unreadBefore
          : null;

      let after =
        unreadAfter !== null &&
        unreadIndexes.includes(unreadAfter) &&
        unreadAfter > Math.max(...viewport)
          ? unreadAfter
          : null;

      unreadIndexes.forEach(unread => {
        if (viewport?.includes(unread)) {
          return;
        }
        if (unread < (before ?? Math.min(...viewport))) {
          before = unread;
        } else if (
          unread > Math.max(...viewport) &&
          unread < (after ?? model.messages.length)
        ) {
          after = unread;
        }
      });

      setUnreadBefore(before);
      setUnreadAfter(after);
    };

    model.unreadChanged?.connect(unreadChanged);

    unreadChanged(model, model.unreadMessages);

    // Move to the last the message after all the messages have been first rendered.
    gotoMessage(model.messages.length - 1, false);

    return () => {
      model.unreadChanged?.disconnect(unreadChanged);
    };
  }, [model, props.allRendered]);

  // Listen for change in the viewport, to add a navigation button if the last is not
  // in viewport.
  useEffect(() => {
    const viewportChanged = (model: IChatModel, viewport: number[]) => {
      setLastInViewport(viewport.includes(model.messages.length - 1));
    };

    model.viewportChanged?.connect(viewportChanged);

    viewportChanged(model, model.messagesInViewport ?? []);

    return () => {
      model.viewportChanged?.disconnect(viewportChanged);
    };
  }, [model]);

  return (
    <>
      {unreadBefore !== null && (
        <Button
          className={`${NAVIGATION_BUTTON_CLASS} ${NAVIGATION_UNREAD_CLASS} ${NAVIGATION_TOP_CLASS}`}
          onClick={() => gotoMessage!(unreadBefore)}
          title={'Go to unread messages'}
        >
          <LabIcon.resolveReact
            display={'flex'}
            icon={caretDownEmptyIcon}
            iconClass={classes('jp-Icon')}
          />
        </Button>
      )}
      {(unreadAfter !== null || !lastInViewport) && (
        <Button
          className={`${NAVIGATION_BUTTON_CLASS} ${unreadAfter !== null ? NAVIGATION_UNREAD_CLASS : ''} ${NAVIGATION_BOTTOM_CLASS}`}
          onClick={
            unreadAfter === null
              ? () => gotoMessage(model.messages.length - 1, false)
              : () => gotoMessage(unreadAfter)
          }
          title={
            unreadAfter !== null
              ? 'Go to unread messages'
              : 'Go to last message'
          }
        >
          <LabIcon.resolveReact
            display={'flex'}
            icon={caretDownEmptyIcon}
            iconClass={classes('jp-Icon')}
          />
        </Button>
      )}
    </>
  );
}

/**
 * The avatar props.
 */
type AvatarProps = {
  /**
   * The user to display an avatar.
   */
  user: IUser;
  /**
   * Whether the avatar should be small.
   */
  small?: boolean;
};

/**
 * The avatar component.
 */
export function Avatar(props: AvatarProps): JSX.Element | null {
  const { user } = props;

  const sharedStyles: SxProps<Theme> = {
    height: `${props.small ? '16' : '24'}px`,
    width: `${props.small ? '16' : '24'}px`,
    bgcolor: user.color,
    fontSize: `var(--jp-ui-font-size${props.small ? '0' : '1'})`
  };

  const name =
    user.display_name ?? user.name ?? (user.username || 'User undefined');
  return user.avatar_url ? (
    <MuiAvatar
      sx={{
        ...sharedStyles
      }}
      src={user.avatar_url}
      alt={name}
      title={name}
    ></MuiAvatar>
  ) : user.initials ? (
    <MuiAvatar
      sx={{
        ...sharedStyles
      }}
      alt={name}
      title={name}
    >
      <Typography
        sx={{
          fontSize: `var(--jp-ui-font-size${props.small ? '0' : '1'})`,
          color: 'var(--jp-ui-inverse-font-color1)'
        }}
      >
        {user.initials}
      </Typography>
    </MuiAvatar>
  ) : null;
}
