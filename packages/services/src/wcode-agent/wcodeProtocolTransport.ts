import type { Event, IDisposable } from "@wcode/rpc";
import type { WCodeProtocolMessage } from "@wcode/shared";

export type WCodeProtocolTransportKind = "stdio" | "websocket" | "memory";

export interface WCodeProtocolTransportClosedEvent {
  code?: number | null;
  signal?: NodeJS.Signals | null;
  reason?: string;
}

export interface WCodeProtocolTransport extends IDisposable {
  readonly kind: WCodeProtocolTransportKind;
  readonly onMessage: Event<WCodeProtocolMessage>;
  readonly onClose: Event<WCodeProtocolTransportClosedEvent>;
  send(message: WCodeProtocolMessage): Promise<void>;
  disposeAndWait?(options?: { deadlineAtMs?: number }): Promise<void>;
}
