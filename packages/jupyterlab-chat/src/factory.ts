/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { Chat, ChatWidget, IInputToolbarRegistryFactory } from '@jupyter/chat';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';
import { ISignal, Signal } from '@lumino/signaling';

import { LabChatModel } from './model';
import { LabChatPanel } from './widget';
import { YChat } from './ychat';
import { ILabChatConfig, IWidgetConfig } from './token';

/**
 * The object provided by the chatDocument extension.
 * It is used to set the current config (from settings) to newly created chat widget,
 * and to propagate every changes to the existing chat widgets.
 */
export class WidgetConfig implements IWidgetConfig {
  /**
   * The constructor of the WidgetConfig.
   */
  constructor(config: Partial<ILabChatConfig>) {
    this._config = config;
  }

  /**
   * Getter and setter for the config.
   */
  get config(): Partial<ILabChatConfig> {
    return this._config;
  }
  set config(value: Partial<ILabChatConfig>) {
    this._config = { ...this._config, ...value };
    this._configChanged.emit(value);
  }

  /**
   * Getter for the configChanged signal
   */
  get configChanged(): ISignal<WidgetConfig, Partial<ILabChatConfig>> {
    return this._configChanged;
  }

  private _config: Partial<ILabChatConfig>;
  private _configChanged = new Signal<WidgetConfig, Partial<ILabChatConfig>>(
    this
  );
}

/**
 * A widget factory to create new instances of LabChatWidget.
 */
export class ChatWidgetFactory extends ABCWidgetFactory<
  LabChatPanel,
  LabChatModel
> {
  /**
   * Constructor of ChatWidgetFactory.
   *
   * @param options Constructor options
   */
  constructor(options: ChatWidgetFactory.IOptions<LabChatPanel>) {
    super(options);
    this._chatOptions = options;
    this._inputToolbarFactory = options.inputToolbarFactory;
  }

  /**
   * Create a new widget given a context.
   *
   * @param context Contains the information of the file
   * @returns The widget
   */
  protected createNewWidget(context: ChatWidgetFactory.IContext): LabChatPanel {
    context = { ...context, area: 'main', ...this._chatOptions };
    if (this._inputToolbarFactory) {
      context.inputToolbarRegistry = this._inputToolbarFactory.create();
    }
    return new LabChatPanel({
      context,
      content: new ChatWidget(context)
    });
  }

  /**
   * IMPORTANT: this property must be defined to use the `RtcContentProvider`
   * registered by `jupyter_collaboration`. Without this, the chat document
   * widgets will not connect.
   */
  get contentProviderId(): string {
    return 'rtc';
  }
  // Must override both getter and setter from ABCFactory for type compatibility.
  set contentProviderId(_value: string | undefined) {}
  private _chatOptions: Omit<Chat.IOptions, 'model'>;
  private _inputToolbarFactory?: IInputToolbarRegistryFactory;
}

export namespace ChatWidgetFactory {
  export interface IContext
    extends DocumentRegistry.IContext<LabChatModel>,
      Omit<Chat.IOptions, 'model'> {}

  export interface IOptions<T extends LabChatPanel>
    extends DocumentRegistry.IWidgetFactoryOptions<T>,
      Omit<Chat.IOptions, 'model' | 'inputToolbarRegistry'> {
    inputToolbarFactory: IInputToolbarRegistryFactory;
  }
}

export class LabChatModelFactory
  implements DocumentRegistry.IModelFactory<LabChatModel>
{
  constructor(options: LabChatModel.IOptions) {
    this._modelOptions = options;
  }

  collaborative = true;
  /**
   * The name of the model.
   *
   * @returns The name
   */
  get name(): string {
    return 'chat';
  }

  /**
   * The content type of the file.
   *
   * @returns The content type
   */
  get contentType(): Contents.ContentType {
    return 'chat';
  }

  /**
   * The format of the file.
   *
   * @returns the file format
   */
  get fileFormat(): Contents.FileFormat {
    return 'text';
  }

  /**
   * Get whether the model factory has been disposed.
   *
   * @returns disposed status
   */

  get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Dispose the model factory.
   */
  dispose(): void {
    this._disposed = true;
  }

  /**
   * Get the preferred language given the path on the file.
   *
   * @param path path of the file represented by this document model
   * @returns The preferred language
   */
  preferredLanguage(path: string): string {
    return '';
  }

  /**
   * Create a new instance of LabChatModel.
   *
   * @param languagePreference Language
   * @param modelDB Model database
   * @returns The model
   */

  createNew(options: DocumentRegistry.IModelOptions<YChat>): LabChatModel {
    return new LabChatModel({
      ...options,
      ...this._modelOptions
    });
  }

  private _disposed = false;
  private _modelOptions: Omit<LabChatModel.IOptions, 'sharedModel'>;
}
