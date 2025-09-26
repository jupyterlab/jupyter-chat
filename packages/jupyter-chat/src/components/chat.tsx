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

import {
  ChatInput,
  IInputToolbarRegistry,
  InputToolbarRegistry
} from './input';
import { JlThemeProvider } from './jl-theme-provider';
import { ChatMessages } from './messages';
import { ChatReactContext } from '../context';
import { IChatModel } from '../model';
import {
  IAttachmentOpenerRegistry,
  IChatCommandRegistry,
  IMessageFooterRegistry
} from '../registers';

export function ChatBody(props: Chat.IChatProps): JSX.Element {
  const { model } = props;
  let { inputToolbarRegistry } = props;
  if (!inputToolbarRegistry) {
    inputToolbarRegistry = InputToolbarRegistry.defaultToolbarRegistry();
  }

  const contextValue: Chat.IChatProps = {
    ...props,
    inputToolbarRegistry
  };

  return (
    <ChatReactContext.Provider value={contextValue}>
      <ChatMessages />
      <ChatInput
        sx={{
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 0,
          paddingBottom: 0,
          borderTop: '1px solid var(--jp-border-color1)'
        }}
        model={model.input}
      />
    </ChatReactContext.Provider>
  );
}

export function Chat(props: Chat.IOptions): JSX.Element {
  const [view, setView] = useState<Chat.View>(Chat.View.chat);
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
        {view === Chat.View.chat && <ChatBody {...props} />}
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
  export interface IChatProps {
    /**
     * The chat model.
     */
    model: IChatModel;
    /**
     * The rendermime registry.
     */
    rmRegistry: IRenderMimeRegistry;
    /**
     * Chat command registry.
     */
    chatCommandRegistry?: IChatCommandRegistry;
    /**
     * Attachment opener registry.
     */
    attachmentOpenerRegistry?: IAttachmentOpenerRegistry;
    /**
     * The input toolbar registry
     */
    inputToolbarRegistry?: IInputToolbarRegistry;
    /**
     * The footer registry.
     */
    messageFooterRegistry?: IMessageFooterRegistry;
    /**
     * The welcome message.
     */
    welcomeMessage?: string;
  }

  /**
   * The options to build the Chat UI.
   */
  export interface IOptions extends IChatProps {
    /**
     * The theme manager.
     */
    themeManager?: IThemeManager | null;
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
