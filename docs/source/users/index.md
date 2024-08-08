# Users

## Collaborative chat

The `jupyterlab-collaborative-chat` extension adds collaborative chats to jupyterlab.

![collaborative chat](../_static/images/collaboarative-chat.png)

These chats use the collaborative edition in jupyterlab [jupyter_collaboration](https://jupyterlab-realtime-collaboration.readthedocs.io/en/latest/).

### Install collaborative chat

The collaborative chat is available on [PyPI](https://pypi.org/project/jupyterlab-collaborative-chat/).

```bash
pip install jupyterlab-collaborative-chat
```

To uninstall the package:

```bash
pip uninstall jupyterlab-collaborative-chat
```

### Create a chat

There are several ways to create a chat:

- using the menu : *file -> new -> chat*
- using the commands palette (`Ctrl+Shift+C`) -> *Create a new chat*
- from the left panel ![chat icon](../../../packages/jupyter-chat/style/icons/chat.svg){w=24px},
click on the button ![left panel new chat](../_static/images/left-panel-new-chat.png){h=24px}

Validating the dialog will create the new chat.

Creating a chat actually creates a file in the tree files.

```{warning}
Currently, the left panel can only discover chat files in the root directory (to avoid
computation issues in large tree files), so it only creates chat files in the root
directory.

Creating a chat using the menu or the command palette will create the file in the
current directory of the file browser.
```

### Open a chat

There are also several ways to open a chat:

- opening the file from the file browser
- using the commands palette (`Ctrl+Shift+C`) -> *Open a chat*. It opens a dialog to
enter fill the file path
- from the left panel ![chat icon](../../../packages/jupyter-chat/style/icons/chat.svg){w=24px},
there is a dropdown listing the chat files, in the root directory only.

```{note}
Opening the chat from the file browser or the command palette will open it in the main
area, like any other document.

Opening a chat from the left panel will open it in the left panel.
```

## Websocket chat

The `jupyterlab-ws-chat` extension adds a chat panel relying on websocket for messaging.

```{warning}
This extension is currently under development, and users may encounter issues with it.
```

### Install websocket chat

The websocket chat is available on [PyPI](https://pypi.org/project/jupyterlab-ws-chat/).

```bash
pip install jupyterlab-ws-chat
```

To uninstall the package:

```bash
pip uninstall jupyterlab-ws-chat
```

### Open the chat

The chat can be opened from the left panel ![chat icon](../../../packages/jupyter-chat/style/icons/chat.svg){w=24px}.

## Chat usage

The chat UI is composed of a list of messages and an input to send new messages.

A message can be edited or deleted by its author, using a toolbar in the message.

### Notifications and navigation

If enabled in [settings](#chat-settings), new unread messages generate a notification.

A down arrow in the messages list allow to navigate to the last message. This button is highlighted if some new messages are unread.

(code-toolbar)=

### Code toolbar

When code is inserted in a message, a toolbar is displayed under the code section (if
the options is set up from the [settings](#chat-settings)).

From this toolbar, the code can be copied to the clipboard: ![code toolbar copy](../_static/images/code-toolbar-copy.png){w=24px}.

If a notebook is opened and visible, other actions are available:

- copy the code to a new cell above the current one: ![code toolbar cell above](../_static/images/code-toolbar-above.png){w=24px}
- copy the the code to a new cell below the current one: ![code toolbar cell below](../_static/images/code-toolbar-below.png){w=24px}
- replace the content of the current cell with the code: ![code toolbar cell replace](../_static/images/code-toolbar-replace.png){w=24px}

(chat-settings)=

## Chat settings

Some jupyterlab settings are available for the chats (included with `jupyterlab-collaborative-chat` and `jupyterlab-ws-chat`), in the setting panel (menu `Settings->Settings Editor`), with the entry *Chat*.

These settings includes:

- **sendWithShiftEnter**

  Whether to send a message via Shift-Enter instead of Enter.\
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
