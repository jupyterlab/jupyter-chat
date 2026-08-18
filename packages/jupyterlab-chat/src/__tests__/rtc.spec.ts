/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PageConfig } from '@jupyterlab/coreutils';

import {
  SERVER_SESSION_RTC_INFO_KEY,
  getServerSessionRtcInfo,
  isCollaborative
} from '../rtc';

describe('getServerSessionRtcInfo', () => {
  let getOption: jest.SpyInstance;

  beforeEach(() => {
    getOption = jest.spyOn(PageConfig, 'getOption');
  });

  afterEach(() => {
    getOption.mockRestore();
  });

  it('defaults to non-collaborative when the key is absent', () => {
    getOption.mockReturnValue('');
    const info = getServerSessionRtcInfo();
    expect(info.enabled).toBe(false);
    expect(info.provider).toBeNull();
    expect(isCollaborative()).toBe(false);
    expect(getOption).toHaveBeenCalledWith(SERVER_SESSION_RTC_INFO_KEY);
  });

  it('reports collaborative when RTC is enabled', () => {
    getOption.mockReturnValue(
      JSON.stringify({
        enabled: true,
        provider: 'jupyter_server_ydoc',
        providerDetails: {
          installed: ['jupyter_server_ydoc'],
          enabledByServer: ['jupyter_server_ydoc'],
          enabledByTrait: ['jupyter_server_documents', 'jupyter_server_ydoc']
        }
      })
    );
    const info = getServerSessionRtcInfo();
    expect(info.enabled).toBe(true);
    expect(info.provider).toBe('jupyter_server_ydoc');
    expect(isCollaborative()).toBe(true);
  });

  it('reports non-collaborative when RTC is disabled', () => {
    getOption.mockReturnValue(
      JSON.stringify({
        enabled: false,
        provider: null,
        providerDetails: {
          installed: [],
          enabledByServer: [],
          enabledByTrait: ['jupyter_server_documents']
        }
      })
    );
    expect(isCollaborative()).toBe(false);
  });

  it('falls back to non-collaborative on malformed JSON', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    getOption.mockReturnValue('{not valid json');
    expect(getServerSessionRtcInfo().enabled).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
