// 平台能力面收敛：设置页「插件管理」的薄服务接口。
//
// 背景：pluginManagementStore / usePluginUninstall 过去直接注入 IWCodeAgentService，
// UI 层因此散布 13 个 plugins/* 旧协议词的消费点。收敛为独立薄 service 后，UI 只依赖
// 本接口；plugins/* 词表的 host 侧消费点收拢到 pluginManagementService 一处（插件的
// 事实源在 wcode-cli 进程，服务实现仍经 agent 协议往返——plugins 词表的收口归属
// 插件能力面自身的协议演进，不在会话 v4 词表范围内）。
// 注意与既有 IPluginsService（已 retired 的 marketplace pluginStore 通道）区分：
// 那套接口按 pluginName+marketplace 寻址且方法语义过时，不复用避免签名冲突。
import type { Event } from "@wcode/rpc";
import type {
  WCodePluginOperationProgressNotification,
  WCodePluginsConfigureResult,
  WCodePluginsCancelOperationResult,
  WCodePluginsDescribeResult,
  WCodePluginsInstallResult,
  WCodePluginsListResult,
  WCodePluginsMarketplaceMutationResult,
  WCodePluginsOverviewResult,
  WCodePluginsReferenceCatalogResult,
  WCodePluginsRestoreBuiltinResult,
  WCodePluginsSetEnabledResult,
  WCodePluginsUninstallResult,
  WCodePluginsValidateResult,
} from "@wcode/shared";
import { ServiceChannels } from "@wcode/shared";
import { createServiceDescriptor } from "../descriptors.js";
import type {
  WCodeAgentAddPluginMarketplaceParams,
  WCodeAgentConfigurePluginParams,
  WCodeAgentCancelPluginOperationParams,
  WCodeAgentDescribePluginParams,
  WCodeAgentInstallPluginParams,
  WCodeAgentPluginReferenceCatalogParams,
  WCodeAgentResolveSuggestedPluginReferenceParams,
  WCodeAgentResetPluginConfigParams,
  WCodeAgentPluginViewParams,
  WCodeAgentRemovePluginMarketplaceParams,
  WCodeAgentRestoreBuiltinPluginParams,
  WCodeAgentSetPluginEnabledParams,
  WCodeAgentUninstallPluginParams,
  WCodeAgentUpdatePluginMarketplaceParams,
  WCodeAgentUpdatePluginParams,
  WCodeAgentValidatePluginParams,
} from "../wcode-agent/wcodeAgentPluginParams.js";

export interface IPluginManagementService {
  listPlugins(params: WCodeAgentPluginViewParams): Promise<WCodePluginsListResult>;
  /**
   * Plugin 对话引用 catalog：
   * 带 sessionId → session-owned 冻结 catalog；不带 → workspace 当前 catalog。
   * 实现路由到 workspace 级 agent client，不走插件管理独立进程。
   */
  getPluginReferenceCatalog(
    params: WCodeAgentPluginReferenceCatalogParams,
  ): Promise<WCodePluginsReferenceCatalogResult>;
  resolveSuggestedPluginReference(
    params: WCodeAgentResolveSuggestedPluginReferenceParams,
  ): Promise<import("@wcode/shared").WCodePluginsResolveSuggestedReferenceResult>;
  onDynamicPluginOperationProgress(
    operationId: string,
  ): Event<WCodePluginOperationProgressNotification>;
  getPluginsOverview(params: WCodeAgentPluginViewParams): Promise<WCodePluginsOverviewResult>;
  addPluginMarketplace(
    params: WCodeAgentAddPluginMarketplaceParams,
  ): Promise<WCodePluginsMarketplaceMutationResult>;
  removePluginMarketplace(
    params: WCodeAgentRemovePluginMarketplaceParams,
  ): Promise<WCodePluginsMarketplaceMutationResult>;
  updatePluginMarketplace(
    params: WCodeAgentUpdatePluginMarketplaceParams,
  ): Promise<WCodePluginsMarketplaceMutationResult>;
  installPlugin(params: WCodeAgentInstallPluginParams): Promise<WCodePluginsInstallResult>;
  cancelPluginOperation(
    params: WCodeAgentCancelPluginOperationParams,
  ): Promise<WCodePluginsCancelOperationResult>;
  uninstallPlugin(params: WCodeAgentUninstallPluginParams): Promise<WCodePluginsUninstallResult>;
  updatePlugin(params: WCodeAgentUpdatePluginParams): Promise<WCodePluginsInstallResult>;
  restoreBuiltinPlugin(
    params: WCodeAgentRestoreBuiltinPluginParams,
  ): Promise<WCodePluginsRestoreBuiltinResult>;
  configurePlugin(params: WCodeAgentConfigurePluginParams): Promise<WCodePluginsConfigureResult>;
  resetPluginConfig(
    params: WCodeAgentResetPluginConfigParams,
  ): Promise<WCodePluginsConfigureResult>;
  validatePlugin(params: WCodeAgentValidatePluginParams): Promise<WCodePluginsValidateResult>;
  describePlugin(params: WCodeAgentDescribePluginParams): Promise<WCodePluginsDescribeResult>;
  setPluginEnabled(params: WCodeAgentSetPluginEnabledParams): Promise<WCodePluginsSetEnabledResult>;
}

export const IPluginManagementService = createServiceDescriptor<IPluginManagementService>(
  ServiceChannels.PluginManagement,
);

/** 入口只附加观测上下文；RPC 方法由 Proxy 动态提供，不能通过对象展开复制。 */
export function withPluginTelemetry(
  service: IPluginManagementService,
  telemetry: NonNullable<WCodeAgentInstallPluginParams["telemetry"]>,
): IPluginManagementService {
  const mutations = new Set<PropertyKey>([
    "addPluginMarketplace",
    "removePluginMarketplace",
    "updatePluginMarketplace",
    "installPlugin",
    "uninstallPlugin",
    "updatePlugin",
    "restoreBuiltinPlugin",
    "configurePlugin",
    "resetPluginConfig",
    "setPluginEnabled",
  ]);
  return new Proxy(service, {
    get(target, property) {
      const method = Reflect.get(target, property, target);
      if (typeof method !== "function") return method;
      if (!mutations.has(property)) return method.bind(target);
      return (params: WCodeAgentInstallPluginParams) =>
        method.call(target, { ...params, telemetry });
    },
  });
}
