export interface HelloMessage {
  type: "wcode-hello";
  version: string;
  platform: string;
  arch: string;
  pid: number;
}

export interface HelloAckMessage {
  type: "wcode-hello-ack";
  version: string;
  clientId: string;
}
