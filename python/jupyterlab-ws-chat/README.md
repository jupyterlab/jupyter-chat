# jupyterlab_ws_chat

[![Github Actions Status](https://github.com/brichet/jupyterlab-ws-chat/workflows/Build/badge.svg)](https://github.com/brichet/jupyterlab-ws-chat/actions/workflows/build.yml)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/brichet/jupyterlab-ws-chat/HEAD?urlpath=lab)

A chat extension for Jupyterlab, based on websocket for exchanging messages.

This package is composed of a Python package named `jupyterlab_ws_chat`
for the server side and a NPM package named `jupyterlab-ws-chat-extension`

![screenshot](screenshot.png 'WS chat extension')

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the package, execute:

```bash
pip install jupyterlab_ws_chat
```

## Uninstall

To remove the package, execute:

```bash
pip uninstall jupyterlab_ws_chat
```

## Using the chat

The chat UI is composed of a list of messages and an input to send new messages.

A message can be edited or deleted by its author, using a dedicated toolbar in the
message.

### Open the chat

The chat can be opened from the left panel
<img src=https://raw.githubusercontent.com/jupyterlab/jupyter-chat/a66480412b4cb8c7b2c415afca06b24c98dbf55f/packages/jupyter-chat/style/icons/chat.svg width=24px style='vertical-align: middle;'>.

### Notifications and navigation

If enabled in [settings](#chat-settings), new unread messages generate a notification.

A down arrow in the messages list allow to navigate to the last message. This button is
highlighted if some new messages are unread.

(code-toolbar)=

### Code toolbar

When code is inserted in a message, a toolbar is displayed under the code section (the
options must be set up from the [settings](#chat-settings)).

From this toolbar, the code can be copied to the clipboard:
<img src=https://raw.githubusercontent.com/jupyterlab/jupyter-chat/refs/heads/main/docs/source/_static/images/code-toolbar-copy.png width=24px style='vertical-align: middle;'>

If a notebook is opened and visible (and has an active cell), other actions are
available:

- copy the code to a new cell above the active one:
  <img src=https://raw.githubusercontent.com/jupyterlab/jupyter-chat/refs/heads/main/docs/source/_static/images/code-toolbar-above.png width=24px style='vertical-align: middle;'>
- copy the the code to a new cell below the active one:
  <img src=https://raw.githubusercontent.com/jupyterlab/jupyter-chat/refs/heads/main/docs/source/_static/images/code-toolbar-below.png width=24px style='vertical-align: middle;'>
- replace the content of the active cell with the code:
  <img src=https://raw.githubusercontent.com/jupyterlab/jupyter-chat/refs/heads/main/docs/source/_static/images/code-toolbar-replace.png width=24px style='vertical-align: middle;'>

### Chat settings

Some jupyterlab settings are available for the chats in the setting panel
(menu `Settings->Settings Editor`), with the entry _Chat_.

These settings includes:

- **sendWithShiftEnter**

  Whether to send a message using Shift-Enter instead of Enter.\
  Default: false

- **stackMessages**

  Whether to stack consecutive messages from same user.\
  Default: true

- **unreadNotifications**

  Whether to enable or not the notifications on unread messages.\
  Default: true

- **enableCodeToolbar**

  Whether to enable or not the code toolbar.\
  Default: true

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Install package in development mode
pip install -e ".[test]"
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable jupyterlab_ws_chat
# Rebuild Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable jupyterlab_ws_chat
pip uninstall jupyterlab_ws_chat
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterlab-ws-chat-extension` within that folder.

### Testing the package

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
