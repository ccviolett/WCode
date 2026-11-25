import { ServiceChannels } from "@wcode/shared";
import type {
  TraceId,
  WCodeAgentMcpServer,
  WCodeDeliveryKind,
  WCodeMessageWithParts,
  ModelSelection,
  WCodePermissionRequestParams,
  WCodeProviderRuntimeHeadersRequestParams,
  WCodeUserInputRequestParams,
  WCodeUserInputResponse,
  WCodeSessionInfo,
  WCodeSessionImportHistory,
  WCodeSessionEvent,
  WCodeSessionMode,
  WCodeSessionPersistence,
  WCodeSessionStateSnapshot,
  WCodeStateUpdatedNotification,
  WCodeWorkspacePresentation,
} from "@wcode/shared";
import { createServiceDescriptor } from "#src/descriptors.js";
import type { ProviderRuntimeHeadersUiResponse } from "#src/wcode-agent/wcodeAgent.js";

export interface WCodeSessionWorkspaceTarget {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
}

export type WCodeSessionReadWorkspacePresentationParams = WCodeSessionWorkspaceTarget;

export interface WCodeTaskTarget extends WCodeSessionWorkspaceTarget {
  sessionId: string;
}

export interface WCodeSessionCreateParams extends WCodeSessionWorkspaceTarget {
  /** 仅导入事务使用的预分配 ID；普通新会话继续由 Agent 分配。 */
  sessionId?: string;
  sessionTraceId?: TraceId;
  parentSessionId?: string;
  mode?: WCodeSessionMode;
  model?: ModelSelection;
  persistence?: WCodeSessionPersistence;
  thoughtLevel?: string;
  mcpServers?: WCodeAgentMcpServer[];
  importedHistory?: WCodeSessionImportHistory;
}

export interface WCodeSessionResumeParams extends WCodeTaskTarget {
  model?: ModelSelection;
  thoughtLevel?: string;
  mcpServers?: WCodeAgentMcpServer[];
  /**
   * 默认广播 resume 得到的历史快照，并让 shadow 订阅请求初始 snapshot。
   * 续聊发送前的 runtime 预恢复会关闭它，避免旧终态快照覆盖本地已开始的新输入运行态。
   */
  broadcastSnapshot?: boolean;
}

export interface WCodeSessionListParams extends WCodeSessionWorkspaceTarget {
  limit?: number;
}

export interface WCodeSessionReadParams extends WCodeTaskTarget {
  deliveryKind?: WCodeDeliveryKind;
  messageLimit?: number;
  afterSeq?: number;
}

export interface WCodeSessionMessagesParams extends WCodeTaskTarget {
  afterMessageId?: string;
  limit?: number;
}

export interface WCodeSessionEventsParams extends WCodeTaskTarget {
  afterSeq?: number;
  limit?: number;
}

export interface WCodeSessionSetModelParams extends WCodeTaskTarget {
  model: ModelSelection;
  expectedRevision?: number;
  persistAsWorkspaceLastUsed?: boolean;
}

export interface WCodeSessionSetThoughtLevelParams extends WCodeTaskTarget {
  thoughtLevel?: string;
  expectedRevision?: number;
  persistAsWorkspaceLastUsed?: boolean;
}

export interface WCodeSessionSetModeParams extends WCodeTaskTarget {
  mode: WCodeSessionMode;
  expectedRevision?: number;
}

export interface WCodeSessionRespondProviderRuntimeHeadersParams extends WCodeTaskTarget {
  requestId: string;
  response: ProviderRuntimeHeadersUiResponse;
}

export interface WCodeSessionSubscribeParams extends WCodeTaskTarget {
  deliveryKind: WCodeDeliveryKind;
  afterSeq?: number;
  includeSnapshot?: boolean;
  eventCoalescing?: {
    mode: "background-summary";
    intervalMs?: number;
  };
}

export type WCodeSessionServiceEvent =
  | { type: "session.event"; event: WCodeSessionEvent }
  | { type: "state.updated"; notification: WCodeStateUpdatedNotification }
  | { type: "permission.request"; request: WCodePermissionRequestParams }
  | { type: "userInput.request"; request: WCodeUserInputRequestParams }
  | {
      type: "userInput.response";
      requestId: string;
      response: WCodeUserInputResponse;
    }
  | { type: "providerRuntimeHeaders.request"; request: WCodeProviderRuntimeHeadersRequestParams }
  | { type: "snapshot"; snapshot: WCodeSessionStateSnapshot };

export interface WCodeSessionInitializeResult {
  available: boolean;
  workspaceKey: string;
  protocolName?: string;
  protocolVersion?: number;
  transportKind?: "stdio" | "websocket";
  reason?: string;
  reasonCode?: "provider_not_ready";
}

export interface WCodeSessionWorkspaceRuntimeIdentity {
  generation: number;
  identity: string;
  processId?: number;
  workspaceKey: string;
}

export interface IWCodeSessionService {
  initializeWorkspace(params: WCodeSessionWorkspaceTarget): Promise<WCodeSessionInitializeResult>;
  getWorkspaceRuntimeIdentity(
    params: WCodeSessionWorkspaceTarget,
  ): Promise<WCodeSessionWorkspaceRuntimeIdentity>;
  readWorkspacePresentation(
    params: WCodeSessionReadWorkspacePresentationParams,
  ): Promise<WCodeWorkspacePresentation>;
  createSession(params: WCodeSessionCreateParams): Promise<WCodeSessionStateSnapshot>;
  resumeSession(params: WCodeSessionResumeParams): Promise<WCodeSessionStateSnapshot>;
  listSessions(params: WCodeSessionListParams): Promise<WCodeSessionInfo[]>;
  readSession(params: WCodeSessionReadParams): Promise<WCodeSessionStateSnapshot>;
  readSessionMessages(params: WCodeSessionMessagesParams): Promise<WCodeMessageWithParts[]>;
  readSessionEvents(params: WCodeSessionEventsParams): Promise<WCodeSessionEvent[]>;
  promoteDeferredDraftSession(params: WCodeTaskTarget): Promise<void>;
  closeSession(params: WCodeTaskTarget): Promise<void>;
  closeDeferredDraftSession(params: WCodeTaskTarget): Promise<boolean>;
  setModel(params: WCodeSessionSetModelParams): Promise<WCodeSessionStateSnapshot>;
  setThoughtLevel(params: WCodeSessionSetThoughtLevelParams): Promise<WCodeSessionStateSnapshot>;
  setMode(params: WCodeSessionSetModeParams): Promise<WCodeSessionStateSnapshot>;
  respondProviderRuntimeHeaders(
    params: WCodeSessionRespondProviderRuntimeHeadersParams,
  ): Promise<void>;
  // M5 删波次 2：onDynamicSessionEvent（旧 session/subscribe 词表的 renderer 订阅面）
  // 已删除——v4 UI 走 agentService 的 conversation/sessions-index 帧通道，
  // 该方法在 renderer 侧已无任何调用者（grep packages/ui packages/desktop 为零）。
}

export const IWCodeSessionService = createServiceDescriptor<IWCodeSessionService>(
  ServiceChannels.WCodeSession,
);
