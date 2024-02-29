import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChatService } from '../../services';

type ServerInfoProperties = {
  config: ChatService.DescribeConfigResponse;
};

type ServerInfoMethods = {
  refetchAll: () => Promise<void>;
};

export enum ServerInfoState {
  /**
   * Server info is being fetched.
   */
  Loading,
  /**
   * Unable to retrieve server info.
   */
  Error,
  /**
   * Server info was loaded successfully.
   */
  Ready
}

type ServerInfoLoading = { state: ServerInfoState.Loading };
type ServerInfoError = {
  state: ServerInfoState.Error;
  error: string;
};
type ServerInfoReady = { state: ServerInfoState.Ready } & ServerInfoProperties &
  ServerInfoMethods;

type ServerInfo = ServerInfoLoading | ServerInfoError | ServerInfoReady;

/**
 * A hook that fetches the current configuration and provider lists from the
 * server. Returns a `ServerInfo` object that includes methods.
 */
export function useServerInfo(): ServerInfo {
  const [state, setState] = useState<ServerInfoState>(ServerInfoState.Loading);
  const [serverInfoProps, setServerInfoProps] =
    useState<ServerInfoProperties>();
  const [error, setError] = useState<string>('');

  const fetchServerInfo = useCallback(async () => {
    try {
      const config = await ChatService.getConfig();
      setServerInfoProps({ config });

      setState(ServerInfoState.Ready);
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        setError(e.toString());
      } else {
        setError('An unknown error occurred.');
      }
      setState(ServerInfoState.Error);
    }
  }, []);

  /**
   * Effect: fetch server info on initial render
   */
  useEffect(() => {
    fetchServerInfo();
  }, []);

  return useMemo<ServerInfo>(() => {
    if (state === ServerInfoState.Loading) {
      return { state };
    }

    if (state === ServerInfoState.Error || !serverInfoProps) {
      return { state: ServerInfoState.Error, error };
    }

    return {
      state,
      ...serverInfoProps,
      refetchAll: fetchServerInfo
    };
  }, [state, serverInfoProps, error]);
}
