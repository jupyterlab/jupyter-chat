/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IThemeManager, ReactWidget } from '@jupyterlab/apputils';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { Alert, Box } from '@mui/material';
import React from 'react';

import { JlThemeProvider } from '../components/jl-theme-provider';
import { chatIcon } from '../icons';

const TRANSLATION_DOMAIN = 'jupyterlab_chat';

export function buildErrorWidget(
  themeManager: IThemeManager | null,
  translator?: ITranslator
): ReactWidget {
  const trans = (translator ?? nullTranslator).load(TRANSLATION_DOMAIN);
  const ErrorWidget = ReactWidget.create(
    <JlThemeProvider themeManager={themeManager}>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: 'var(--jp-layout-color0)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ padding: 4 }}>
          <Alert severity="error">
            {trans.__(
              'There seems to be a problem with the Chat backend, please look at the JupyterLab server logs or contact your administrator to correct this problem.'
            )}
          </Alert>
        </Box>
      </Box>
    </JlThemeProvider>
  );
  ErrorWidget.id = 'jupyter-chat::chat';
  ErrorWidget.title.icon = chatIcon;
  ErrorWidget.title.caption = trans.__('Jupyter Chat');

  return ErrorWidget;
}
