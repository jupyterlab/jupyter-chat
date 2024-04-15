/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { ChatWidget, IChatModel, IConfig } from 'chat-jupyter';
import { IThemeManager } from '@jupyterlab/apputils';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import { Signal } from '@lumino/signaling';
import { Awareness } from 'y-protocols/awareness';

import { CollaborativeChatModel } from './model';
import { CollaborativeChatWidget } from './widget';
import { YChat } from './ychat';
import { IWidgetConfig } from './token';

/**
 * The object provided by the chatDocument extension.
 * It is used to set the current config (from settings) to newly created chat widget,
 * and to propagate every changes to the existing chat widgets.
 */
export class WidgetConfig implements IWidgetConfig {
  /**
   * The constructor of the ChatDocument.
   */
  constructor(config: Partial<IConfig>) {
    this.config = config;
    this.configChanged.connect((_, config) => {
      this.config = { ...this.config, ...config };
    });
  }

  config: Partial<IConfig>;
  configChanged = new Signal<this, Partial<IConfig>>(this);
}

/**
 * A widget factory to create new instances of CollaborativeChatWidget.
 */
export class ChatWidgetFactory extends ABCWidgetFactory<
  CollaborativeChatWidget,
  CollaborativeChatModel
> {
  /**
   * Constructor of ChatWidgetFactory.
   *
   * @param options Constructor options
   */
  constructor(options: ChatWidgetFactory.IOptions<CollaborativeChatWidget>) {
    super(options);
    this._themeManager = options.themeManager;
    this._rmRegistry = options.rmRegistry;
  }

  /**
   * Create a new widget given a context.
   *
   * @param context Contains the information of the file
   * @returns The widget
   */
  protected createNewWidget(
    context: ChatWidgetFactory.IContext
  ): CollaborativeChatWidget {
    context.chatModel = context.model;
    context.rmRegistry = this._rmRegistry;
    context.themeManager = this._themeManager;
    return new CollaborativeChatWidget({
      context,
      content: new ChatWidget(context)
    });
  }

  private _themeManager: IThemeManager | null;
  private _rmRegistry: IRenderMimeRegistry;
}

export namespace ChatWidgetFactory {
  export interface IContext
    extends DocumentRegistry.IContext<CollaborativeChatModel> {
    chatModel: IChatModel;
    themeManager: IThemeManager | null;
    rmRegistry: IRenderMimeRegistry;
  }

  export interface IOptions<T extends CollaborativeChatWidget>
    extends DocumentRegistry.IWidgetFactoryOptions<T> {
    themeManager: IThemeManager | null;
    rmRegistry: IRenderMimeRegistry;
  }
}

export class CollaborativeChatModelFactory
  implements DocumentRegistry.IModelFactory<CollaborativeChatModel>
{
  constructor(options: CollaborativeChatModel.IOptions) {
    this._awareness = options.awareness;
    this._widgetConfig = options.widgetConfig;
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
      awareness: this._awareness,
      widgetConfig: this._widgetConfig
    });
  }

  private _disposed = false;
  private _awareness: Awareness;
  private _widgetConfig: IWidgetConfig;
}
