/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import React, { useState, useEffect } from 'react';
import type { IThemeManager } from '@jupyterlab/apputils';
import { Theme, ThemeProvider } from '@mui/material/styles';

import { getJupyterLabTheme } from '../theme-provider';

export function JlThemeProvider(props: {
  themeManager: IThemeManager | null;
  children: React.ReactNode;
}): JSX.Element {
  // Wait for the real JupyterLab theme before rendering children. Rendering a
  // stub theme first and then swapping to the real one causes MUI's
  // ThemeProvider to switch its inner provider (ThemeProviderNoVars <->
  // CssVarsProvider), which forces React to unmount and remount the whole
  // subtree. That remount races with the ReactiveToolbar's throttled resizer.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    async function setJlTheme() {
      setTheme(await getJupyterLabTheme());
    }

    setJlTheme();
    props.themeManager?.themeChanged.connect(setJlTheme);
  }, []);

  if (!theme) {
    return <></>;
  }

  return <ThemeProvider theme={theme}>{props.children}</ThemeProvider>;
}
