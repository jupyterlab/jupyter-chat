/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { shouldDisplayWelcomeMessage } from '../components/messages/messages';
import { IConfig } from '../types';

describe('welcome message visibility', () => {
  const welcomeMessage = 'Welcome!';

  it('should hide if no welcome message is provided', () => {
    expect(
      shouldDisplayWelcomeMessage({
        config: {},
        messageCount: 0
      })
    ).toBeFalsy();
  });

  it('should display for empty chats by default', () => {
    expect(
      shouldDisplayWelcomeMessage({
        welcomeMessage,
        config: {},
        messageCount: 0
      })
    ).toBeTruthy();
  });

  it('should auto-hide after the first message by default', () => {
    expect(
      shouldDisplayWelcomeMessage({
        welcomeMessage,
        config: {},
        messageCount: 1
      })
    ).toBeFalsy();
  });

  it('should keep showing after messages if auto-hide is disabled', () => {
    const config: IConfig = { autoHideWelcomeMessage: false };
    expect(
      shouldDisplayWelcomeMessage({
        welcomeMessage,
        config,
        messageCount: 1
      })
    ).toBeTruthy();
  });

  it('should always hide when configured', () => {
    const config: IConfig = {
      autoHideWelcomeMessage: false,
      hideWelcomeMessage: true
    };
    expect(
      shouldDisplayWelcomeMessage({
        welcomeMessage,
        config,
        messageCount: 0
      })
    ).toBeFalsy();
  });

  it('should display after first message when auto-hide is disabled and always-hide is disabled', () => {
    const config: IConfig = {
      autoHideWelcomeMessage: false,
      hideWelcomeMessage: false
    };
    expect(
      shouldDisplayWelcomeMessage({
        welcomeMessage,
        config,
        messageCount: 1
      })
    ).toBeTruthy();
  });
});
