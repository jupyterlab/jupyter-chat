/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import { IconButton } from '@mui/material';
import { Box } from '@mui/system';
import React, { useState } from 'react';

import { JlThemeProvider } from './jl-theme-provider';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { IChatModel } from '../model';
import { IAutocompletionRegistry } from '../registry';
import { IChatCommandRegistry } from '../chat-commands';

export function ChatBody(props: Chat.IChatBodyProps): JSX.Element {
  const {
    model,
    rmRegistry: renderMimeRegistry,
    autocompletionRegistry
  } = props;
  // no need to append to messageGroups imperatively here. all of that is
  // handled by the listeners registered in the effect hooks above.
  const onSend = async (input: string) => {
    // send message to backend
    model.sendMessage({ body: input });
  };

  return (
    <>
      <ChatMessages rmRegistry={renderMimeRegistry} model={model} />
      <ChatInput
        onSend={onSend}
        sx={{
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 3.5,
          paddingBottom: 0,
          borderTop: '1px solid var(--jp-border-color1)'
        }}
        model={model}
        autocompletionRegistry={autocompletionRegistry}
        chatCommandRegistry={props.chatCommandRegistry}
      />
    </>
  );
}

export function Chat(props: Chat.IOptions): JSX.Element {
  const [view, setView] = useState<Chat.View>(props.chatView || Chat.View.chat);
  return (
    <JlThemeProvider themeManager={props.themeManager ?? null}>
      <Box
        // Add .jp-ThemedContainer for CSS compatibility in both JL <4.3.0 and >=4.3.0.
        // See: https://jupyterlab.readthedocs.io/en/latest/extension/extension_migration.html#css-styling
        className="jp-ThemedContainer"
        // root box should not include padding as it offsets the vertical
        // scrollbar to the left
        sx={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--jp-layout-color0)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* top bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {view !== Chat.View.chat ? (
            <IconButton onClick={() => setView(Chat.View.chat)}>
              <ArrowBackIcon />
            </IconButton>
          ) : (
            <Box />
          )}
          {view !== Chat.View.settings && props.settingsPanel ? (
            <IconButton onClick={() => setView(Chat.View.settings)}>
              <SettingsIcon />
            </IconButton>
          ) : (
            <Box />
          )}
        </Box>
        {/* body */}
        {view === Chat.View.chat && (
          <ChatBody
            model={props.model}
            rmRegistry={props.rmRegistry}
            autocompletionRegistry={props.autocompletionRegistry}
            chatCommandRegistry={props.chatCommandRegistry}
          />
        )}
        {view === Chat.View.settings && props.settingsPanel && (
          <props.settingsPanel />
        )}
      </Box>
    </JlThemeProvider>
  );
}

/**
 * The chat UI namespace
 */
export namespace Chat {
  /**
   * The props for the chat body component.
   */
  export interface IChatBodyProps {
    /**
     * The chat model.
     */
    model: IChatModel;
    /**
     * The rendermime registry.
     */
    rmRegistry: IRenderMimeRegistry;
    /**
     * Autocompletion registry.
     */
    autocompletionRegistry?: IAutocompletionRegistry;
    /**
     * Autocompletion name.
     */
    autocompletionName?: string;
    /**
     * Chat command registry.
     */
    chatCommandRegistry?: IChatCommandRegistry;
  }

  /**
   * The options to build the Chat UI.
   */
  export interface IOptions extends IChatBodyProps {
    /**
     * The theme manager.
     */
    themeManager?: IThemeManager | null;
    /**
     * The view to render.
     */
    chatView?: View;
    /**
     * A settings panel that can be used for dedicated settings (e.g. jupyter-ai)
     */
    settingsPanel?: () => JSX.Element;
  }

  /**
   * The view to render.
   * The settings view is available only if the settings panel is provided in options.
   */
  export enum View {
    chat,
    settings
  }
}
