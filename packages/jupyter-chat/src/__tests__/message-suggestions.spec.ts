/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { RenderMimeRegistry } from '@jupyterlab/rendermime';

import { ChatWidget } from '../widgets/chat-widget';
import { IMessageSuggestionsFactory } from '../tokens';
import { IChatModel } from '../model';
import { MockChatModel } from './mocks';

describe('MessageSuggestions', () => {
  let model: IChatModel;
  let rmRegistry: RenderMimeRegistry;

  beforeEach(() => {
    model = new MockChatModel();
    rmRegistry = new RenderMimeRegistry();
  });

  it('should create a widget without messageSuggestionsFactory', () => {
    const widget = new ChatWidget({ model, rmRegistry });
    expect(widget).toBeInstanceOf(ChatWidget);
    widget.dispose();
  });

  it('should create a widget with messageSuggestionsFactory', () => {
    const factory: IMessageSuggestionsFactory = {
      create: jest.fn().mockReturnValue(null)
    };
    const widget = new ChatWidget({
      model,
      rmRegistry,
      messageSuggestionsFactory: factory
    });
    expect(widget).toBeInstanceOf(ChatWidget);
    widget.dispose();
  });

  it('should call sendMessage when factory onSend is invoked', () => {
    const factory: IMessageSuggestionsFactory = {
      create: jest.fn().mockReturnValue(null)
    };

    const sendSpy = jest.spyOn(model, 'sendMessage');

    // Simulate what MessageSuggestions component does:
    factory.create({ onSend: (body: string) => model.sendMessage({ body }) });

    // Invoke the onSend passed to factory
    const props = (factory.create as jest.Mock).mock
      .calls[0][0] as IMessageSuggestionsFactory.IProps;
    props.onSend('Hello world');

    expect(sendSpy).toHaveBeenCalledWith({ body: 'Hello world' });
  });

  it('should not fail when factory returns null', () => {
    const factory: IMessageSuggestionsFactory = {
      create: jest.fn().mockReturnValue(null)
    };

    const result = factory.create({
      onSend: (body: string) => model.sendMessage({ body })
    });
    expect(result).toBeNull();
  });
});
