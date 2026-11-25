import type {
  ModelSelection,
  WCodeAgentMcpServer,
  WCodeAutomationScheduleRule,
  WCodeMcpListMode,
} from "@wcode/shared";
import type { McpAppsAppToolCallResult, McpAppsAppToolDescriptor } from "@wcode/shared/mcp-apps";

export interface WCodeAgentWorkspaceTarget {
  workspacePath: string;
  workspaceIdentity?: string;
  /** 远程 workspace 的运行时会话身份；只用于隔离/路由，不能替代 workspacePath。 */
  remoteSessionId?: string;
}

export interface WCodeAgentPluginMutationTarget extends WCodeAgentWorkspaceTarget {
  /** 仅 Host 观测使用；不会传给 CLI。 */
  telemetry?: {
    entry?:
      | "store_list"
      | "store_detail"
      | "side_pane_market"
      | "recommended_prompt"
      | "recommended_ui"
      | "component_settings";
    client_kind?: "desktop" | "mobile";
    trigger?: "user" | "automatic" | "dependency" | "restore" | "sync";
  };
}

export interface WCodeAgentPluginViewParams extends WCodeAgentWorkspaceTarget {
  configScope?: "user" | "workspace";
}

export interface WCodeAgentListMcpServerStatusesParams extends WCodeAgentWorkspaceTarget {
  mcpServers?: WCodeAgentMcpServer[];
  mode?: WCodeMcpListMode;
}

export interface WCodeAgentAddPluginMarketplaceParams extends WCodeAgentPluginMutationTarget {
  dryRun?: boolean;
  operationId?: string;
  source: string;
}

export interface WCodeAgentRemovePluginMarketplaceParams extends WCodeAgentPluginMutationTarget {
  marketplace: string;
}

export interface WCodeAgentUpdatePluginMarketplaceParams extends WCodeAgentPluginMutationTarget {
  marketplace?: string;
  operationId?: string;
}

export interface WCodeAgentInstallPluginParams extends WCodeAgentPluginMutationTarget {
  dryRun?: boolean;
  marketplace: string;
  operationId?: string;
  pluginName: string;
  scope?: "user" | "workspace";
}

export interface WCodeAgentCancelPluginOperationParams {
  operationId: string;
}

export interface WCodeAgentUninstallPluginParams extends WCodeAgentPluginMutationTarget {
  marketplace?: string;
  pluginId?: string;
  pluginName?: string;
  removeCache?: boolean;
}

export interface WCodeAgentUpdatePluginParams extends WCodeAgentPluginMutationTarget {
  pluginId?: string;
  marketplace?: string;
}

export interface WCodeAgentRestoreBuiltinPluginParams extends WCodeAgentPluginMutationTarget {
  pluginId: string;
}

export interface WCodeAgentConfigurePluginParams extends WCodeAgentPluginMutationTarget {
  clearOptionKeys?: string[];
  dryRun?: boolean;
  options: Record<string, unknown>;
  pluginId: string;
  scope?: "user" | "workspace";
}

export interface WCodeAgentResetPluginConfigParams extends WCodeAgentPluginMutationTarget {
  pluginId: string;
  scope?: "user" | "workspace";
}

export interface WCodeAgentValidatePluginParams extends WCodeAgentWorkspaceTarget {
  marketplace?: string;
  pluginName?: string;
  source?: string;
}

export interface WCodeAgentDescribePluginParams extends WCodeAgentWorkspaceTarget {
  marketplace: string;
  pluginName: string;
}

export interface WCodeAgentSetPluginEnabledParams extends WCodeAgentPluginMutationTarget {
  enabled: boolean;
  operationId?: string;
  pluginId: string;
  scope?: "user" | "workspace";
}

/** 信任或撤销项目 `plugins.dirs` 声明的目录插件（docs/plugins/workspace-plugin-dir-trust.md）。 */
export interface WCodeAgentSetWorkspacePluginTrustParams extends WCodeAgentWorkspaceTarget {
  pluginRoot: string;
  declarationDigest: string;
  trusted: boolean;
}

// Plugin 对话引用 catalog：
// 带 sessionId → session-owned 冻结 catalog（必须路由到持有该 session 的 workspace client）；
// 不带 → workspace 当前 catalog（新建草稿 Picker）。
export interface WCodeAgentPluginReferenceCatalogParams extends WCodeAgentWorkspaceTarget {
  sessionId?: string;
}

// Composer Skill catalog：与 Plugin 引用相同，以 sessionId 区分 workspace 当前目录和
// resident Session runtime 快照；不参与 Settings 管理目录。
export interface WCodeAgentSkillReferenceCatalogParams extends WCodeAgentWorkspaceTarget {
  sessionId?: string;
}

/** 插件 UI：UI 发起的 `ui://` 资源读取。 */
export interface WCodeAgentReadMcpResourceParams extends WCodeAgentWorkspaceTarget {
  instance: import("@wcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  uri: string;
}

/** 插件 UI 页面发起的 `resources/read`；参数与 readMcpResource 同形，结果受 8 MiB 与 mimeType 白名单约束。 */
export type WCodeAgentReadMcpResourceForUiParams = WCodeAgentReadMcpResourceParams;

/** 插件 UI：UI 回调本插件工具；不进审批流，归属由 agent 侧 catalog fail closed。 */
export interface WCodeAgentCallMcpToolForUiParams extends WCodeAgentWorkspaceTarget {
  instance: import("@wcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  /** 宿主生成的调用 id，配合 cancelMcpToolCallForUi。 */
  callId: string;
}
/** 插件 UI 页面发起的 resources/list、resources/templates/list、subscribe、unsubscribe。 */
export interface WCodeAgentListMcpResourcesForUiParams extends WCodeAgentWorkspaceTarget {
  instance: import("@wcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  cursor?: string;
}
/** App-Provided Tools：实例身份 = 会话 + 沙箱作用域 + 代际。 */
export interface WCodeAgentAppToolInstanceForUiParams extends WCodeAgentWorkspaceTarget {
  instance: import("@wcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  scopeId: string;
  generation: number;
}
export interface WCodeAgentRegisterAppToolsForUiParams extends WCodeAgentAppToolInstanceForUiParams {
  tools: McpAppsAppToolDescriptor[];
}
export interface WCodeAgentAppToolCallForUiParams extends WCodeAgentAppToolInstanceForUiParams {
  callId: string;
}
export interface WCodeAgentResolveAppToolCallForUiParams extends WCodeAgentAppToolCallForUiParams {
  result?: McpAppsAppToolCallResult;
  error?: { message: string };
}
export interface WCodeAgentMcpResourceSubscriptionForUiParams extends WCodeAgentWorkspaceTarget {
  instance: import("@wcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  scopeId: string;
  generation: number;
  uri: string;
}
export interface WCodeAgentCancelMcpToolCallForUiParams extends WCodeAgentWorkspaceTarget {
  instance: import("@wcode/shared/mcp-apps").McpAppInstance;
  sessionId: string;
  pluginId: string;
  serverName: string;
  callId: string;
}
export interface WCodeAgentResolveSuggestedPluginReferenceParams extends WCodeAgentWorkspaceTarget {
  stableId: string;
  operationId: string;
  clientMode: "desktop-continuous" | "web-remote-replayable";
  deliveryKind: "desktop-continuous" | "web-remote-replayable";
}

// ---- 定时任务(automation)管理参数 ----

export interface WCodeAgentCreateAutomationParams extends WCodeAgentWorkspaceTarget {
  projectId?: string | null;
  title: string;
  cronExpr: string;
  relativeDelayMinutes?: number;
  prompt: string;
  modelSelection?: ModelSelection;
  mode?: string;
  recurring?: boolean;
  maxRuns?: number;
  endAt?: number;
  scheduleRule?: WCodeAutomationScheduleRule;
}

export interface WCodeAgentUpdateAutomationParams extends WCodeAgentWorkspaceTarget {
  automationId: string;
  title?: string;
  cronExpr?: string;
  prompt?: string;
  modelSelection?: ModelSelection | null;
  mode?: string | null;
  recurring?: boolean;
  maxRuns?: number | null;
  endAt?: number | null;
  scheduleRule?: WCodeAutomationScheduleRule | null;
  scheduleEditedByUser?: boolean;
}

export interface WCodeAgentAutomationIdParams extends WCodeAgentWorkspaceTarget {
  automationId: string;
}

export interface WCodeAgentSetAutomationEnabledParams extends WCodeAgentWorkspaceTarget {
  automationId: string;
  enabled: boolean;
}

export interface WCodeAgentDeleteAutomationRunParams extends WCodeAgentWorkspaceTarget {
  runId: string;
}
