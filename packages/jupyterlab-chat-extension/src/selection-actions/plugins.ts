/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ADD_TO_CHAT_ACTION_ID,
  IChatModel,
  IChatTracker,
  ISelectionActionRegistry,
  ISelectionWatcher,
  MultiChatPanel,
  SelectionActionRegistry,
  SelectionPopup,
  TRANSLATION_DOMAIN,
  getEditor
} from '@jupyter/chat';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { Widget } from '@lumino/widgets';
import {
  CommandIDs,
  IMultiChatPanel,
  ISelectionWatcherToken,
  IWidgetConfig,
  SelectionPopupController,
  resolveSelectionDestination
} from 'jupyterlab-chat';

/**
 * Extension providing the registry of the actions over an editor selection.
 */
export const selectionActionRegistryPlugin: JupyterFrontEndPlugin<ISelectionActionRegistry> =
  {
    id: 'jupyterlab-chat-extension:selection-action-registry',
    description:
      'The selection action registry used by the jupyterlab-chat-extension.',
    autoStart: true,
    provides: ISelectionActionRegistry,
    optional: [ITranslator],
    activate: (app, translator: ITranslator | null) => {
      const trans = (translator ?? nullTranslator).load(TRANSLATION_DOMAIN);
      return SelectionActionRegistry.defaultRegistry(trans);
    }
  };

/**
 * Extension showing the popup of the actions over an editor selection, and the
 * command to add the selection to a chat.
 */
export const selectionPopupPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat-extension:selection-popup',
  description: 'The popup displaying the actions over an editor selection.',
  autoStart: true,
  requires: [ISelectionActionRegistry, ISelectionWatcherToken, IWidgetConfig],
  optional: [IChatTracker, IMultiChatPanel, ICommandPalette, ITranslator],
  activate: (
    app,
    registry: ISelectionActionRegistry,
    watcher: ISelectionWatcher,
    widgetConfig: IWidgetConfig,
    tracker: IChatTracker | null,
    chatPanel: MultiChatPanel | null,
    palette: ICommandPalette | null,
    translator: ITranslator | null
  ) => {
    const trans = (translator ?? nullTranslator).load(TRANSLATION_DOMAIN);

    const popup: SelectionPopup = new SelectionPopup({
      registry,
      translator: translator ?? undefined,
      beforeRun: action => controller.beforeRun(action),
      reposition: () => controller.reposition()
    });
    Widget.attach(popup, document.body);

    // Open a chat in the side panel when there is none. A chat in the main
    // area would hide the document the selection is in.
    const createChat = async (): Promise<IChatModel | null> => {
      try {
        // The command that opens a chat in the side panel is registered late.
        if (!app.commands.hasCommand(CommandIDs.openChat)) {
          return null;
        }
        await app.commands.execute(CommandIDs.createAndOpen, {
          inSidePanel: true
        });
        return chatPanel?.current?.model ?? null;
      } catch (e) {
        console.error('Failed to open a new chat', e);
        return null;
      }
    };
    // One chat at a time: a second trigger shares the first.
    let opening: Promise<IChatModel | null> | null = null;
    const openNewChat = () =>
      (opening ??= createChat().finally(() => {
        opening = null;
      }));

    const controller: SelectionPopupController = new SelectionPopupController({
      document,
      watcher,
      popup,
      getEditor,
      getWidget: id => {
        const widget = Array.from(app.shell.widgets()).find(w => w.id === id);
        return widget instanceof DocumentWidget ? widget : null;
      },
      resolveDestination: () =>
        tracker ? resolveSelectionDestination(tracker) : null,
      reveal: destination =>
        // A chat in the side panel is shown by activating the panel.
        app.shell.activateById(
          destination.area === 'sidebar' && chatPanel
            ? chatPanel.id
            : destination.id
        ),
      openNewChat: tracker && chatPanel ? openNewChat : undefined,
      // The setting is `undefined` until the settings are loaded.
      isEnabled: () => widgetConfig.config.showSelectionActions ?? false
    });
    widgetConfig.configChanged.connect(() => controller.update());
    controller.update();

    const getAddToChatAction = () =>
      registry.getActions().find(action => action.id === ADD_TO_CHAT_ACTION_ID);

    app.commands.addCommand(CommandIDs.addToChat, {
      label: trans.__('Add selection to chat'),
      caption: trans.__('Stage the editor selection in a chat input'),
      describedBy: { args: { type: 'object', properties: {} } },
      isEnabled: () => {
        const source = controller.context();
        const action = getAddToChatAction();
        return (
          !!source && !!action && (action.isEnabled?.(source.context) ?? true)
        );
      },
      execute: async () => {
        const action = getAddToChatAction();
        const context = action && controller.beforeRun(action);
        if (action && context) {
          await action.run(context);
        }
      }
    });
    watcher.selectionChanged.connect(() =>
      app.commands.notifyCommandChanged(CommandIDs.addToChat)
    );
    palette?.addItem({
      command: CommandIDs.addToChat,
      category: trans.__('Chat')
    });
  }
};
