/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
import { Token } from '@lumino/coreutils';
import { IAttachment, IAutocompletionCommandsProps } from './types';

/**
 * The token for the autocomplete registry, which can be provided by an extension
 * using @jupyter/chat package.
 */
export const IAutocompletionRegistry = new Token<IAutocompletionRegistry>(
  '@jupyter/chat:IAutocompleteRegistry'
);

/**
 * The interface of a registry to provide autocompleters.
 */
export interface IAutocompletionRegistry {
  /**
   * The default autocompletion name.
   */
  default: string | null;
  /**
   * Get the default autocompletion.
   */
  getDefaultCompletion(): IAutocompletionCommandsProps | undefined;
  /**
   * Return a registered autocomplete props.
   *
   * @param name - the name of the registered autocomplete props.
   */
  get(name: string): IAutocompletionCommandsProps | undefined;

  /**
   * Register autocomplete props.
   *
   * @param name - the name for the registration.
   * @param autocompletion - the autocomplete props.
   */
  add(name: string, autocompletion: IAutocompletionCommandsProps): boolean;

  /**
   * Remove a registered autocomplete props.
   *
   * @param name - the name of the autocomplete props.
   */
  remove(name: string): boolean;
}

/**
 * A registry to provide autocompleters.
 */
export class AutocompletionRegistry implements IAutocompletionRegistry {
  /**
   * Getter and setter for the default autocompletion name.
   */
  get default(): string | null {
    return this._default;
  }
  set default(name: string | null) {
    if (name === null || this._autocompletions.has(name)) {
      this._default = name;
    } else {
      console.warn(`There is no registered completer with the name '${name}'`);
    }
  }

  /**
   * Get the default autocompletion.
   */
  getDefaultCompletion(): IAutocompletionCommandsProps | undefined {
    if (this._default === null) {
      return undefined;
    }
    return this._autocompletions.get(this._default);
  }

  /**
   * Return a registered autocomplete props.
   *
   * @param name - the name of the registered autocomplete props.
   */
  get(name: string): IAutocompletionCommandsProps | undefined {
    return this._autocompletions.get(name);
  }

  /**
   * Register autocomplete props.
   *
   * @param name - the name for the registration.
   * @param autocompletion - the autocomplete props.
   */
  add(
    name: string,
    autocompletion: IAutocompletionCommandsProps,
    isDefault: boolean = false
  ): boolean {
    if (!this._autocompletions.has(name)) {
      this._autocompletions.set(name, autocompletion);
      if (this._autocompletions.size === 1 || isDefault) {
        this.default = name;
      }
      return true;
    } else {
      console.warn(`A completer with the name '${name}' is already registered`);
      return false;
    }
  }

  /**
   * Remove a registered autocomplete props.
   *
   * @param name - the name of the autocomplete props.
   */
  remove(name: string): boolean {
    return this._autocompletions.delete(name);
  }

  /**
   * Remove all registered autocompletions.
   */
  removeAll(): void {
    this._autocompletions.clear();
  }

  private _default: string | null = null;
  private _autocompletions = new Map<string, IAutocompletionCommandsProps>();
}

/**
 * The token for the attachments opener registry, which can be provided by an extension
 * using @jupyter/chat package.
 */
export const IAttachmentOpenerRegistry = new Token<IAttachmentOpenerRegistry>(
  '@jupyter/chat:IAttachmentOpenerRegistry'
);

/**
 * The interface of a registry to provide attachments opener.
 */
export interface IAttachmentOpenerRegistry {
  /**
   * Get the function opening an attachment for a given type.
   */
  get(type: string): ((attachment: IAttachment) => void) | undefined;
  /**
   * Register a function to open an attachment type.
   */
  set(type: string, opener: (attachment: IAttachment) => void): void;
}

/**
 * The default registry, a Map object.
 */
export class AttachmentOpenerRegistry
  extends Map<string, (attachment: IAttachment) => void>
  implements IAttachmentOpenerRegistry {}
