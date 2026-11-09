/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IRenderMime } from '@jupyterlab/rendermime';
import {
  addIcon,
  ReactWidget,
  ToolbarButtonComponent
} from '@jupyterlab/ui-components';
import { ISignal } from '@lumino/signaling';
import React, { useEffect, useState } from 'react';

import { useTranslator } from '../context';

/**
 * The default placeholder widget.
 */
export class defaultPlaceholder extends ReactWidget {
  constructor(options: Placeholder.IProps) {
    super();
    this._props = options;
  }

  render() {
    return <PlaceholderComponent {...this._props} />;
  }

  private _props: Placeholder.IProps;
}

/**
 * The placeholder namespace.
 */
export namespace Placeholder {
  /**
   * The options of the placeholder widget.
   */
  export interface IProps {
    /**
     * The initial chats, as an object mapping the chat keys to their names.
     */
    chatNames: { [key: string]: string };
    /**
     * A callback to open an existing chat by key.
     *
     * @param key - the key of the chat to open.
     */
    open: (key: string) => Promise<void>;
    /**
     * A callback to create and open a new chat.
     */
    onCreate?: () => Promise<void>;
    /**
     * An optional signal emitting when the chat list changes.
     */
    chatNamesChanged?: ISignal<any, { [key: string]: string }>;
    /**
     * An optional translation bundle.
     */
    trans?: IRenderMime.TranslationBundle;
  }
}

/**
 * The default placeholder component.
 */
const PlaceholderComponent = (props: Placeholder.IProps): JSX.Element => {
  const trans = props.trans ?? useTranslator();

  const [chatNames, setChatNames] = useState<{ [key: string]: string }>(
    props.chatNames
  );

  useEffect(() => {
    if (!props.chatNamesChanged) {
      return;
    }
    const onChanged = (_: any, names: { [key: string]: string }) => {
      setChatNames(names);
    };
    props.chatNamesChanged.connect(onChanged);
    return () => {
      props.chatNamesChanged!.disconnect(onChanged);
    };
  }, [props.chatNamesChanged]);

  const chats = Object.entries(chatNames).sort(([, a], [, b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="jp-chat-placeholder">
      <h3>{trans.__('No chat opened')}</h3>
      {props.onCreate && (
        <div className="jp-chat-placeholder-hint">
          <ToolbarButtonComponent
            label={trans.__('New chat')}
            icon={addIcon}
            onClick={props.onCreate}
            tooltip={trans.__('Create a new chat')}
            className="jp-chat-add"
          />
        </div>
      )}
      {chats.length > 0 && (
        <div className="jp-chat-placeholder-list">
          <p>{trans.__('Open an existing chat:')}</p>
          {chats.map(([key, name]) => (
            <div key={key}>
              <button
                className="jp-chat-placeholder-chat-item"
                onClick={() => props.open(key)}
              >
                {name}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
