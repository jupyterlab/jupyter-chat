import { requestAPI } from './handler';

export namespace ChatService {
  export interface IUser {
    id: string;
    username?: string;
    name?: string;
    display_name?: string;
    initials?: string;
    color?: string;
    avatar_url?: string;
  }

  export interface IChatMessage {
    type: 'msg';
    body: string;
    id: string;
    time: number;
    sender: IUser;
  }

  export type ConnectionMessage = {
    type: 'connection';
    client_id: string;
  };

  export type ClearMessage = {
    type: 'clear';
  };

  export type IMessage = IChatMessage | ConnectionMessage | ClearMessage;

  export type ChatHistory = {
    messages: IChatMessage[];
  };

  export type ChatRequest = {
    prompt: string;
  };

  export type DescribeConfigResponse = {
    send_with_shift_enter: boolean;
    last_read: number;
  };

  export type UpdateConfigRequest = {
    send_with_shift_enter?: boolean;
    last_read?: number;
  };

  export async function getConfig(): Promise<DescribeConfigResponse> {
    return requestAPI<DescribeConfigResponse>('config');
  }

  export async function updateConfig(
    config: UpdateConfigRequest
  ): Promise<void> {
    return requestAPI<void>('config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }
}
