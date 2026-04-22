/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

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
     * The initial chat names.
     */
    chatNames: { [name: string]: string };
    /**
     * A callback to open an existing chat by name.
     *
     * @param name - the display name of the chat to open.
     */
    open: (name: string) => Promise<void>;
    /**
     * A callback to create and open a new chat.
     */
    onCreate?: () => Promise<void>;
    /**
     * An optional signal emitting when the chat list changes.
     */
    chatNamesChanged?: ISignal<any, { [name: string]: string }>;
  }
}

/**
 * The default placeholder component.
 */
const PlaceholderComponent = (props: Placeholder.IProps): JSX.Element => {
  const trans = useTranslator();
  const [chatNames, setChatNames] = useState<{ [name: string]: string }>(
    props.chatNames
  );

  useEffect(() => {
    if (!props.chatNamesChanged) {
      return;
    }
    const onChanged = (_: any, names: { [name: string]: string }) => {
      setChatNames(names);
    };
    props.chatNamesChanged.connect(onChanged);
    return () => {
      props.chatNamesChanged!.disconnect(onChanged);
    };
  }, [props.chatNamesChanged]);

  const names = Object.keys(chatNames).sort((a, b) => a.localeCompare(b));

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
      {names.length > 0 && (
        <div className="jp-chat-placeholder-list">
          <p>{trans.__('Open an existing chat:')}</p>
          {names.map(name => (
            <div key={name}>
              <button
                className="jp-chat-placeholder-chat-item"
                onClick={() => props.open(name)}
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
