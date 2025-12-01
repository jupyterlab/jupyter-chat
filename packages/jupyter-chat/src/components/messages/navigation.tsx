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

import { useChatContext } from '../../context';
import { IChatModel } from '../../model';

const NAVIGATION_BUTTON_CLASS = 'jp-chat-navigation';
const NAVIGATION_UNREAD_CLASS = 'jp-chat-navigation-unread';
const NAVIGATION_TOP_CLASS = 'jp-chat-navigation-top';
const NAVIGATION_BOTTOM_CLASS = 'jp-chat-navigation-bottom';

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
      setLastInViewport(
        model.messages.length === 0 ||
          viewport.includes(model.messages.length - 1)
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
