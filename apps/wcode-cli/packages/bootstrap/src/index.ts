// Bootstrap public API surface.

export * from "./app/create-app.js";
export type {
  ListWCodeSessionsOptions,
  PromptInput,
  ResolveLatestSessionOptions,
  ResumeOptions,
  RunWCodeProtocolAgentOptions,
  SendInputOptions,
  SendInputResult,
  SetLocaleResult,
  SteerTurnOptions,
  SubmitPromptOptions,
  UserPromptInput,
  WCodeApp,
  WCodeAppOptions,
  WCodeModelOption,
} from "./app/types.js";
export * from "./auth-login.js";
export {
  inspectWCodeCustomCommand,
  listWCodeCustomCommands,
  loadWCodeCustomCommand,
} from "./custom-commands.js";
export type {
  InspectWCodeCustomCommandOptions,
  ListWCodeCustomCommandsOptions,
  WCodeCustomCommandInspection,
} from "./custom-commands.js";
export { createModelAdapter } from "./model-factory.js";
export type { CreateModelAdapterOptions } from "./model-factory.js";
export {
  createDefaultProviderEndpointRoutingPort,
  resolveProcessProviderEndpointRoutingPort,
} from "./provider-endpoint-routing.js";
export type {
  CreateDefaultProviderEndpointRoutingPortOptions,
  ResolveProcessProviderEndpointRoutingPortOptions,
} from "./provider-endpoint-routing.js";
export { startProcessProviderRegistryRuntime } from "./app/process-provider-registry-runtime.js";
export type { ProcessProviderRegistryRuntimeOptions } from "./app/process-provider-registry-runtime.js";
export {
  addWCodePluginMarketplace,
  getWCodePluginsOverview,
  installWCodeMarketplacePlugin,
  listWCodePlugins,
  removeWCodePluginMarketplace,
  resolveWCodePlugins,
  setWCodePluginEnabled,
  uninstallWCodeMarketplacePlugin,
  updateWCodeMarketplacePlugin,
  updateWCodePluginMarketplace,
  validateWCodePluginPath,
} from "./plugins.js";
export type {
  AddWCodeMarketplaceOptions,
  InstallWCodeMarketplacePluginOptions,
  ListWCodePluginsOptions,
  RemoveWCodeMarketplaceOptions,
  ResolveWCodePluginsOptions,
  SetWCodePluginEnabledOptions,
  SetWCodePluginEnabledResult,
  UninstallWCodeMarketplacePluginOptions,
  UpdateWCodeMarketplaceOptions,
  UpdateWCodeMarketplacePluginOptions,
  ValidateWCodePluginPathOptions,
  WCodeAvailablePluginData,
  WCodeInstalledPluginData,
  WCodeMarketplaceSummaryData,
  WCodeMarketplaceUpdateData,
  WCodePluginInstallData,
  WCodePluginUpdateData,
  WCodePluginsOverviewData,
} from "./plugins.js";
export { runWCodeProtocolAgent } from "./wcode-protocol-entrypoint.js";
// Exposed for the CLI's --output-format stream-json: it needs the same event
// shape the protocol server emits, rather than inventing a second one.
export { mapSessionEvent } from "./wcode-protocol/session-mapper.js";
export { prepareWCodeTelemetryEnv, shutdownWCodeTelemetry } from "./telemetry-bootstrap.js";
export type { SessionTranscriptMessage, SessionTranscriptPart } from "./session-transcript.js";
export { listWCodeSessions, resolveLatestSession } from "./sessions.js";
export { inspectWCodeSkill, listWCodeSkills } from "./skills.js";
export type {
  InspectWCodeSkillOptions,
  ListWCodeSkillsOptions,
  WCodeSkillInspection,
} from "./skills.js";
// Exposed for the CLI's headless slash routing: it must decide "is this a real
// custom command?" with the *same* reserved-name gate the app facade's
// customCommandPromptResolver applies, or the two disagree and a reserved name
// reaches the model as literal prompt text. See prompt-command.ts.
export { isReservedWCodeSlashCommandName } from "./slash-command-surface.js";
export {
  grantWorkspaceHookTrust,
  inspectWorkspaceHookTrust,
  revokeWorkspaceHookTrustCli,
} from "./workspace-hook-trust-cli.js";
export type {
  WorkspaceHookTrustCliItem,
  WorkspaceHookTrustCliStatus,
  WorkspaceHookTrustCliTarget,
} from "./workspace-hook-trust-cli.js";

export {
  createOfficialPluginPreparation,
  type OfficialPluginPreparation,
} from "./app/bundled-plugins.js";
// 嵌入式调用复用产品请求装配，避免来源头与网络配置漂移。
export { createRuntimeAiSdkModelExecutionConfig } from "./model-config.js";
