# Providing a chat in a jupyter extension

Since `@jupyter/chat` is a front end package, extensions using it needs to depend on it
from the javascript package.

The package is available on [npmjs](https://www.npmjs.com/package/@jupyter/chat).

This package provides all the UI components to build a chat, including a widget,
but is not tied to any messaging technology.

```{important}
It's up to the extension to choose which messaging technology to use.
```

## Adding the dependency

In the extension _package.json_ file, the dependency must be added to the `dependencies`
section.

```json
"@jupyter/chat": "^0.3.0"
```

## Including a chat in an extension

The package provides a jupyterlab widget (UI), that can be instantiated from the
extension.

```typescript
import { ChatWidget } from '@jupyter/chat';
```

This widget needs at least 2 arguments, the [model](#model) and the
[rendermime registry](#rendermime-registry).

(model)=

### Model

The model is the entry point to use the chat in a javascript/typescript package.

A model is provided by the package, and already includes all the required methods to
interact with the UI part of the chat.

The extension has to provide a class extending the `@jupyter/chat` model, implementing
at least the `sendMessage()` method.

This method is called when a user sends a message using the input of the chat. It should
contain the code that will dispatch the message through the messaging technology.

As an example, here is a simple model that logs the message to the console and adds it to
the message list.

```typescript
import { ChatModel, IChatMessage, INewMessage } from '@jupyter/chat';

class MyModel extends ChatModel {
  sendMessage(
    newMessage: INewMessage
  ): Promise<boolean | void> | boolean | void {
    console.log(`New Message:\n${newMessage.body}`);
    const message: IChatMessage = {
      body: newMessage.body,
      id: newMessage.id ?? UUID.uuid4(),
      type: 'msg',
      time: Date.now() / 1000,
      sender: { username: 'me' }
    };
    this.messageAdded(message);
  }
}
```

(rendermime-registry)=

### Rendermime registry

The rendermime registry is required to display the messages using markdown syntax.
This registry is provided by jupyterlab with a token, and must be required by the
extension.

### A minimal full extension

The example below adds a new chat to the right panel.

When a user sends a message, it is logged in the console and added to the message list.

```{tip}
In this example, no messages are sent to other potential users.

An exchange system must be included and use the `sendMessage()` and `messageAdded()`
methods to correctly manage message transmission and reception.
```

```typescript
import {
  ChatModel,
  ChatWidget,
  IChatMessage,
  INewMessage
} from '@jupyter/chat';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { UUID } from '@lumino/coreutils';

class MyModel extends ChatModel {
  sendMessage(
    newMessage: INewMessage
  ): Promise<boolean | void> | boolean | void {
    console.log(`New Message:\n${newMessage.body}`);
    const message: IChatMessage = {
      body: newMessage.body,
      id: newMessage.id ?? UUID.uuid4(),
      type: 'msg',
      time: Date.now() / 1000,
      sender: { username: 'me' }
    };
    this.messageAdded(message);
  }
}

const myChatExtension: JupyterFrontEndPlugin<void> = {
  id: 'myExtension:plugin',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  activate: (app: JupyterFrontEnd, rmRegistry: IRenderMimeRegistry): void => {
    const model = new MyModel();
    const widget = new ChatWidget({ model, rmRegistry });

    app.shell.add(widget, 'right');
  }
};

export default [myChatExtension];
```

## Optional parameters of the model

The model accepts some options in the constructor, which bring some additional
features to the chat.

```typescript
interface IOptions {
  /**
   * Initial config for the chat widget.
   */
  config?: IConfig;

  /**
   * Commands registry.
   */
  commands?: CommandRegistry;

  /**
   * Active cell manager
   */
  activeCellManager?: IActiveCellManager | null;
}
```

### config

The config option can be used to set initial [settings](#chat-settings) to the model.

Here is the definition of the config option:

```typescript
interface IConfig {
  /**
   * Whether to send a message via Shift-Enter instead of Enter.
   */
  sendWithShiftEnter?: boolean;
  /**
   * Last read message (no use yet).
   */
  lastRead?: number;
  /**
   * Whether to stack consecutive messages from same user.
   */
  stackMessages?: boolean;
  /**
   * Whether to enable or not the notifications on unread messages.
   */
  unreadNotifications?: boolean;
  /**
   * Whether to enable or not the code toolbar.
   */
  enableCodeToolbar?: boolean;
}
```

If the option is not provided, the default values will be used.

The config can still be modified later using the setter, which allow partial config
object:

```typescript
set config(value: Partial<IConfig>)
```

### commands

The _commands_ option is mandatory to handle the notifications in the chat.

It is the `CommandRegistry` provided by the jupyterlab application. In the previous
example, the modification would be:

{emphasize-lines="6,7"}

```typescript
const myChatExtension: JupyterFrontEndPlugin<void> = {
  id: 'myExtension:plugin',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  activate: (app: JupyterFrontEnd, rmRegistry: IRenderMimeRegistry): void => {
    const { commands } = app;
    const model = new MyModel({ commands });
    const widget = new ChatWidget({ model, rmRegistry });

    app.shell.add(widget, 'right');
  }
};
```

### activeCellManager

The _activeCellManager_ is mandatory to include the [code toolbar](#code-toolbar) to the
chat.

The active cell manager ensures that a Notebook is visible and has an active cell, to
enable the buttons in the code toolbar.

This active cell manager must be instantiated in the extension, to be propagated to the
model. It requires the `INotebookTracker` token, provided by the _notebook-extension_ of
jupyterlab. In the previous example, the modification would be:

{emphasize-lines="2,14,17,20,21,22,23,24"}

```typescript
import {
  ActiveCellManager,
  ChatModel,
  ChatWidget,
  IChatMessage,
  INewMessage
} from '@jupyter/chat';

...

const myChatExtension: JupyterFrontEndPlugin<void> = {
  id: 'myExtension:plugin',
  autoStart: true,
  requires: [INotebookTracker, IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    rmRegistry: IRenderMimeRegistry
  ): void => {
    const activeCellManager = new ActiveCellManager({
      tracker: notebookTracker,
      shell: app.shell
    });
    const model = new MyModel({ activeCellManager });
    const widget = new ChatWidget({ model, rmRegistry });

    app.shell.add(widget, 'right');
  }
};
```

## Optional parameters of the widget

### themeManager

The `themeManager` allows to get the themes from jupyterlab. It is not mandatory but
some components would not be visible with some themes if it is not provided.

This Theme manager can come from the `IThemeManager` token, provided by the
_apputils-extension_ of jupyterlab.

{emphasize-lines="1,7,11,14"}

```typescript
import { IThemeManager } from '@jupyterlab/apputils';

const myChatExtension: JupyterFrontEndPlugin<void> = {
  id: 'myExtension:plugin',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [IThemeManager],
  activate: (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    themeManager: IThemeManager | null
  ): void => {
    const model = new MyModel();
    const widget = new ChatWidget({ model, rmRegistry, themeManager });

    app.shell.add(widget, 'right');
  }
};
```

(attachment-opener-registry)=

### attachmentOpenerRegistry

The `attachmentOpenerRegistry` provides a way to open attachments for a given type.
A simple example is to handle the attached files, by opening them using a command.

```{tip}
To be able to attach files from the chat, you must provide a `IDocumentManager` that will
be used to select the files to attach.
By default the `IDefaultFileBrowser.model.manager` can be used.
```

The default registry is not much than a `Map<string, () => void>`, allowing setting a
specific function for an attachment type.

{emphasize-lines="2,5,9,23,26,34,38,40,41,42,43,49,50"}

```typescript
import {
  AttachmentOpenerRegistry,
  ChatModel,
  ChatWidget,
  IAttachment,
  IChatMessage,
  INewMessage
} from '@jupyter/chat';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';

...

class MyModel extends ChatModel {
  sendMessage(
    newMessage: INewMessage
  ): Promise<boolean | void> | boolean | void {
    const message: IChatMessage = {
      body: newMessage.body,
      id: newMessage.id ?? UUID.uuid4(),
      type: 'msg',
      time: Date.now() / 1000,
      sender: { username: 'me' },
      attachments: this.inputAttachments
    };
    this.messageAdded(message);
    this.clearAttachments();
  }
}

const myChatExtension: JupyterFrontEndPlugin<void> = {
  id: 'myExtension:plugin',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [IDefaultFileBrowser],
  activate: (
    app: JupyterFrontEnd,
    rmRegistry: IRenderMimeRegistry,
    filebrowser: IDefaultFileBrowser | null
  ): void => {
    const attachmentOpenerRegistry = new AttachmentOpenerRegistry();
    attachmentOpenerRegistry.set('file', (attachment: IAttachment) => {
      app.commands.execute('docmanager:open', { path: attachment.value });
    });

    const model = new MyModel();
    const widget = new ChatWidget({
      model,
      rmRegistry,
      documentManager: filebrowser?.model.manager,
      attachmentOpenerRegistry
    });

    app.shell.add(widget, 'right');
  }
};
```
