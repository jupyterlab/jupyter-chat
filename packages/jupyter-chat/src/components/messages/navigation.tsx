/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Button } from '@jupyter/react-components';
import {
  LabIcon,
  caretDownEmptyIcon,
  classes
} from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';

import { useChatContext, useTranslator } from '../../context';
import { IChatModel } from '../../model';

const NAVIGATION_BUTTON_CLASS = 'jp-chat-navigation';
const NAVIGATION_UNREAD_CLASS = 'jp-chat-navigation-unread';
const NAVIGATION_TOP_CLASS = 'jp-chat-navigation-top';
const NAVIGATION_BOTTOM_CLASS = 'jp-chat-navigation-bottom';

/**
 * The index of the last message expected to be rendered, or -1 when no message
 * is rendered at all. Deleted messages are skipped when the 'showDeleted'
 * setting is disabled, so the navigation should consider the last visible
 * message instead of the last one in the model.
 *
 * @param model - the chat model.
 * @returns the index of the last rendered message.
 */
function lastRenderedMessageIndex(model: IChatModel): number {
  if (model.config.showDeleted) {
    return model.messages.length - 1;
  }
  for (let i = model.messages.length - 1; i >= 0; i--) {
    if (!model.messages[i].deleted) {
      return i;
    }
  }
  return -1;
}

/**
 * The navigation component props.
 */
type NavigationProps = {
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
  const { model } = useChatContext();
  const trans = useTranslator();
  const [lastInViewport, setLastInViewport] = useState<boolean>(true);
  const [unreadBefore, setUnreadBefore] = useState<number | null>(null);
  const [unreadAfter, setUnreadAfter] = useState<number | null>(null);

  const gotoMessage = (msgIdx: number, alignToTop: boolean = true) => {
    const msgEl = props.refMsgBox.current?.querySelector(
      `[data-index="${msgIdx}"]`
    );
    if (msgEl) {
      msgEl.scrollIntoView(alignToTop);
    } else {
      // The message is not rendered (deleted and hidden), so scroll to the
      // last visible message instead.
      props.refMsgBox.current?.scrollIntoView(false);
    }
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
    gotoMessage(lastRenderedMessageIndex(model), false);

    return () => {
      model.unreadChanged?.disconnect(unreadChanged);
    };
  }, [model, props.allRendered]);

  // Listen for change in the viewport, to add a navigation button if the last is not
  // in viewport.
  useEffect(() => {
    const viewportChanged = (model: IChatModel, viewport: number[]) => {
      setLastInViewport(
        model.messages.length === 0 ||
          viewport.includes(lastRenderedMessageIndex(model))
      );
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
          title={trans.__('Go to unread messages')}
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
              ? () => gotoMessage(lastRenderedMessageIndex(model), false)
              : () => gotoMessage(unreadAfter)
          }
          title={
            unreadAfter !== null
              ? trans.__('Go to unread messages')
              : trans.__('Go to last message')
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
