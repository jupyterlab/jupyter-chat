/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import {
  ChatWidget,
  IActiveCellManager,
  IAutocompletionRegistry,
  IConfig
} from '@jupyter/chat';
import { IThemeManager } from '@jupyterlab/apputils';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents, User } from '@jupyterlab/services';
import { CommandRegistry } from '@lumino/commands';
import { ISignal, Signal } from '@lumino/signaling';

import { CollaborativeChatModel } from './model';
import { CollaborativeChatPanel } from './widget';
import { YChat } from './ychat';
import { IWidgetConfig } from './token';

/**
 * The object provided by the chatDocument extension.
 * It is used to set the current config (from settings) to newly created chat widget,
 * and to propagate every changes to the existing chat widgets.
 */
export class WidgetConfig implements IWidgetConfig {
  /**
   * The constructor of the WidgetConfig.
   */
  constructor(config: Partial<IConfig>) {
    this._config = config;
  }

  /**
   * Getter and setter for the config.
   */
  get config(): Partial<IConfig> {
    return this._config;
  }
  set config(value: Partial<IConfig>) {
    this._config = { ...this._config, ...value };
    this._configChanged.emit(value);
  }

  /**
   * Getter for the configChanged signal
   */
  get configChanged(): ISignal<WidgetConfig, Partial<IConfig>> {
    return this._configChanged;
  }

  private _config: Partial<IConfig>;
  private _configChanged = new Signal<WidgetConfig, Partial<IConfig>>(this);
}

/**
 * A widget factory to create new instances of CollaborativeChatWidget.
 */
export class ChatWidgetFactory extends ABCWidgetFactory<
  CollaborativeChatPanel,
  CollaborativeChatModel
> {
  /**
   * Constructor of ChatWidgetFactory.
   *
   * @param options Constructor options
   */
  constructor(options: ChatWidgetFactory.IOptions<CollaborativeChatPanel>) {
    super(options);
    this._themeManager = options.themeManager;
    this._rmRegistry = options.rmRegistry;
    this._autocompletionRegistry = options.autocompletionRegistry;
  }

  /**
   * Create a new widget given a context.
   *
   * @param context Contains the information of the file
   * @returns The widget
   */
  protected createNewWidget(
    context: ChatWidgetFactory.IContext
  ): CollaborativeChatPanel {
    context.rmRegistry = this._rmRegistry;
    context.themeManager = this._themeManager;
    context.autocompletionRegistry = this._autocompletionRegistry;
    return new CollaborativeChatPanel({
      context,
      content: new ChatWidget(context)
    });
  }

  private _themeManager: IThemeManager | null;
  private _rmRegistry: IRenderMimeRegistry;
  private _autocompletionRegistry?: IAutocompletionRegistry;
}

export namespace ChatWidgetFactory {
  export interface IContext
    extends DocumentRegistry.IContext<CollaborativeChatModel> {
    themeManager: IThemeManager | null;
    rmRegistry: IRenderMimeRegistry;
    autocompletionRegistry?: IAutocompletionRegistry;
  }

  export interface IOptions<T extends CollaborativeChatPanel>
    extends DocumentRegistry.IWidgetFactoryOptions<T> {
    themeManager: IThemeManager | null;
    rmRegistry: IRenderMimeRegistry;
    autocompletionRegistry?: IAutocompletionRegistry;
  }
}

export class CollaborativeChatModelFactory
  implements DocumentRegistry.IModelFactory<CollaborativeChatModel>
{
  constructor(options: CollaborativeChatModel.IOptions) {
    this._user = options.user;
    this._widgetConfig = options.widgetConfig;
    this._commands = options.commands;
    this._activeCellManager = options.activeCellManager ?? null;
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
   * Create a new instance of CollaborativeChatModel.
   *
   * @param languagePreference Language
   * @param modelDB Model database
   * @returns The model
   */

  createNew(
    options: DocumentRegistry.IModelOptions<YChat>
  ): CollaborativeChatModel {
    return new CollaborativeChatModel({
      ...options,
      user: this._user,
      widgetConfig: this._widgetConfig,
      commands: this._commands,
      activeCellManager: this._activeCellManager
    });
  }

  private _disposed = false;
  private _user: User.IIdentity | null;
  private _widgetConfig: IWidgetConfig;
  private _commands?: CommandRegistry;
  private _activeCellManager: IActiveCellManager | null;
}
