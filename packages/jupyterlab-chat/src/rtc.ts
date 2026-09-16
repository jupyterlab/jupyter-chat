/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { PageConfig } from '@jupyterlab/coreutils';

/**
 * An RTC provider server-extension name. Mirror of the Python ``RTCProvider``
 * Literal in ``jupyterlab_chat.rtc_lib``.
 */
export type RTCProvider = 'jupyter_server_documents' | 'jupyter_server_ydoc';

/**
 * Resolved RTC state for the current server session, published by the
 * ``jupyterlab_chat`` server extension into PageConfig. Mirror of the Python
 * ``ServerSessionRtcInfo`` dataclass.
 */
export interface IServerSessionRtcInfo {
  /**
   * Whether an RTC provider is active this session. When true, chat runs in
   * collaborative (Yjs) mode; when false, it uses the plain WebSocket
   * transport. This is the single source of truth for ``collaborative``.
   */
  enabled: boolean;

  /**
   * Which RTC backend is active (informational), or null.
   */
  provider: RTCProvider | null;

  /**
   * Diagnostic detail about RTC providers in this session.
   */
  providerDetails: {
    installed: string[];
    enabledByServer: string[];
    enabledByTrait: string[];
  };
}

/**
 * The PageConfig key under which the server publishes the session RTC info.
 * Must match ``jupyterlab_chat.rtc_lib.PAGE_CONFIG_KEY``.
 */
export const SERVER_SESSION_RTC_INFO_KEY = 'serverSessionRtcInfo';

/**
 * RTC state assumed when the server published nothing (e.g. the
 * ``jupyterlab_chat`` server extension is not loaded): no RTC, WebSocket chat.
 */
const DEFAULT_RTC_INFO: IServerSessionRtcInfo = {
  enabled: false,
  provider: null,
  providerDetails: { installed: [], enabledByServer: [], enabledByTrait: [] }
};

/**
 * Read the RTC session info the server published into PageConfig.
 *
 * ``PageConfig.getOption`` returns '' when the key is absent; in that case we
 * fall back to the non-collaborative default so chat still works.
 */
export function getServerSessionRtcInfo(): IServerSessionRtcInfo {
  const raw = PageConfig.getOption(SERVER_SESSION_RTC_INFO_KEY);
  if (!raw) {
    return DEFAULT_RTC_INFO;
  }
  try {
    return JSON.parse(raw) as IServerSessionRtcInfo;
  } catch (e) {
    console.error(
      `Failed to parse '${SERVER_SESSION_RTC_INFO_KEY}' from PageConfig`,
      e
    );
    return DEFAULT_RTC_INFO;
  }
}

/**
 * Whether the chat should run in collaborative (RTC) mode this session.
 * Derived solely from the server's decision published via PageConfig.
 */
export function isCollaborative(): boolean {
  return getServerSessionRtcInfo().enabled;
}
