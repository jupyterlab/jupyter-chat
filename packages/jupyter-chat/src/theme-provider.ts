/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import '@mui/material/Button';
import '@mui/material/IconButton';
import { Theme, createTheme } from '@mui/material/styles';

/**
 * Allow a new variant type, for the input toolbar.
 */
declare module '@mui/material/Button' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface ButtonPropsVariantOverrides {
    'input-toolbar': true;
  }
}

/**
 * Allow a new variant property in IconButton, to be able to set the same properties
 * as the input toolbar buttons.
 */
declare module '@mui/material/IconButton' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface IconButtonOwnProps {
    variant?: 'input-toolbar';
  }
}

function getCSSVariable(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

export async function pollUntilReady(): Promise<void> {
  while (!document.body.hasAttribute('data-jp-theme-light')) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
  }
}

export async function getJupyterLabTheme(): Promise<Theme> {
  await pollUntilReady();
  const light = document.body.getAttribute('data-jp-theme-light') === 'true';
  return createTheme({
    cssVariables: true,
    spacing: 4,
    components: {
      MuiButton: {
        defaultProps: {
          size: 'small',
          variant: 'contained'
        },
        styleOverrides: {
          root: {
            minWidth: '24px',
            width: '24px',
            height: '24px',
            lineHeight: 0,
            '&:disabled': {
              opacity: 0.5
            }
          }
        },
        variants: [
          {
            // The default style for input toolbar button variant.
            props: { variant: 'input-toolbar' },
            style: {
              backgroundColor: `var(--jp-brand-color${light ? '1' : '2'})`,
              color: 'var(--jp-ui-inverse-font-color1)',
              borderRadius: '4px',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: `var(--jp-brand-color${light ? '0' : '1'})`,
                boxShadow: 'none'
              },
              '&:disabled': {
                backgroundColor: 'var(--jp-border-color2)',
                color: 'var(--jp-ui-font-color3)',
                opacity: 0.5
              }
            }
          }
        ]
      },
      MuiFilledInput: {
        defaultProps: {
          margin: 'dense'
        }
      },
      MuiFormControl: {
        defaultProps: {
          margin: 'dense',
          size: 'small'
        }
      },
      MuiFormHelperText: {
        defaultProps: {
          margin: 'dense'
        }
      },
      MuiIconButton: {
        defaultProps: {
          size: 'small'
        },
        styleOverrides: {
          root: {
            minWidth: '24px',
            width: '24px',
            height: '24px',
            lineHeight: 0,
            '&:disabled': {
              opacity: 0.5
            },
            // Set the default size of the svg icon if not set by user.
            '& .MuiSvgIcon-root:not([fontSize])': {
              fontSize: 'medium'
            }
          }
        },
        variants: [
          {
            // The default style for input toolbar button variant.
            props: { variant: 'input-toolbar' },
            style: {
              backgroundColor: `var(--jp-brand-color${light ? '1' : '2'})`,
              color: 'var(--jp-ui-inverse-font-color1)',
              borderRadius: '4px',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: `var(--jp-brand-color${light ? '0' : '1'})`,
                boxShadow: 'none'
              },
              '&:disabled': {
                backgroundColor: 'var(--jp-border-color2)',
                color: 'var(--jp-ui-font-color3)',
                opacity: 0.5
              }
            }
          }
        ]
      },
      MuiInputBase: {
        defaultProps: {
          margin: 'dense',
          size: 'small'
        }
      },
      MuiInputLabel: {
        defaultProps: {
          margin: 'dense'
        }
      },
      MuiListItem: {
        defaultProps: {
          dense: true
        }
      },
      MuiOutlinedInput: {
        defaultProps: {
          margin: 'dense'
        }
      },
      MuiFab: {
        defaultProps: {
          size: 'small'
        }
      },
      MuiTable: {
        defaultProps: {
          size: 'small'
        }
      },
      MuiTextField: {
        defaultProps: {
          margin: 'dense',
          size: 'small'
        }
      },
      MuiToolbar: {
        defaultProps: {
          variant: 'dense'
        }
      }
    },
    palette: {
      mode: light ? 'light' : 'dark',
      primary: {
        main: getCSSVariable(`--jp-brand-color${light ? '1' : '2'}`),
        light: getCSSVariable('--jp-brand-color2'),
        dark: getCSSVariable('--jp-brand-color0')
      },
      error: {
        main: getCSSVariable('--jp-error-color1'),
        light: getCSSVariable('--jp-error-color2'),
        dark: getCSSVariable('--jp-error-color0')
      },
      warning: {
        main: getCSSVariable('--jp-warn-color1'),
        light: getCSSVariable('--jp-warn-color2'),
        dark: getCSSVariable('--jp-warn-color0')
      },
      success: {
        main: getCSSVariable('--jp-success-color1'),
        light: getCSSVariable('--jp-success-color2'),
        dark: getCSSVariable('--jp-success-color0')
      },
      text: {
        primary: getCSSVariable('--jp-ui-font-color1'),
        secondary: getCSSVariable('--jp-ui-font-color2'),
        disabled: getCSSVariable('--jp-ui-font-color3')
      }
    },
    shape: {
      borderRadius: 2
    },
    typography: {
      fontFamily: getCSSVariable('--jp-ui-font-family'),
      fontSize: 12,
      htmlFontSize: 16,
      button: {
        textTransform: 'capitalize'
      }
    }
  });
}
