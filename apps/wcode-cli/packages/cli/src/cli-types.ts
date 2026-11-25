import type { TuiReadClipboardImage, TuiWriteClipboardText } from "@wcode/tui";
import type { UiLocale } from "@wcode/i18n";
import type { Logger } from "@wcode/contracts";
import type {
  createManagedCdpBrowserRuntime,
  ManagedCdpBrowserRuntimeOptions,
} from "@wcode/adapters/browser";
import type {
  createDefaultProviderEndpointRoutingPort,
  createModelAdapter,
  createWCodeApp,
  CreateDefaultProviderEndpointRoutingPortOptions,
  CreateModelAdapterOptions,
  configureCodingPlanApiKey,
  ConfigureCodingPlanApiKeyOptions,
  inspectWCodeSkill,
  inspectWorkspaceHookTrust,
  grantWorkspaceHookTrust,
  revokeWorkspaceHookTrustCli,
  inspectWCodeCustomCommand,
  InspectWCodeCustomCommandOptions,
  InspectWCodeSkillOptions,
  loginWCodeCli,
  loginBigmodelCodingPlan,
  LoginBigmodelCodingPlanOptions,
  LoginWCodeCliOptions,
  listWCodeCustomCommands,
  ListWCodeCustomCommandsOptions,
  loadWCodeCustomCommand,
  listWCodeSessions,
  listWCodeSkills,
  ListWCodeSessionsOptions,
  ListWCodeSkillsOptions,
  logoutWCodeCli,
  LogoutWCodeCliOptions,
  resolveLatestSession,
  ResolveLatestSessionOptions,
  RunWCodeProtocolAgentOptions,
  prepareWCodeTelemetryEnv,
  startProcessProviderRegistryRuntime,
  shutdownWCodeTelemetry,
  WCodeAppOptions,
} from "@wcode/bootstrap";
import type { CliEnv, DotenvLoadResult, LoadCliDotenvOptions } from "./env.js";
import type { PluginsCommandOverrides } from "./plugins-command.js";
import type { CliShutdownProcess } from "./shutdown.js";
import type { resolveWorkspaceGitBranch } from "./tui-workspace-git.js";

export type BootstrapModule = typeof import("@wcode/bootstrap");

export interface RunDependencies extends PluginsCommandOverrides {
  migrateStorage?: () => Promise<import("@wcode/shared/sqlite-migrations").MigrationResult>;
  protocolLifecycle?: RunWCodeProtocolAgentOptions["lifecycle"];
  protocolInput?: NodeJS.ReadableStream;
  createManagedCdpBrowserRuntime?: (
    options?: ManagedCdpBrowserRuntimeOptions,
  ) => ReturnType<typeof createManagedCdpBrowserRuntime>;
  createModelAdapter?: (
    options?: CreateModelAdapterOptions,
  ) => ReturnType<typeof createModelAdapter>;
  createProviderEndpointRoutingPort?: (
    options: CreateDefaultProviderEndpointRoutingPortOptions,
  ) => ReturnType<typeof createDefaultProviderEndpointRoutingPort>;
  createWCodeApp?: (
    options?: WCodeAppOptions,
  ) => Awaited<ReturnType<typeof createWCodeApp>> | ReturnType<typeof createWCodeApp>;
  /**
   * Session-event shaper for --output-format stream-json. Defaults to the
   * bootstrap module's, which is also what the protocol server uses; injectable
   * so a caller that supplies its own `createWCodeApp` (tests, embedders) can
   * still stream, since the bootstrap module is not loaded on that path.
   */
  mapSessionEvent?: BootstrapModule["mapSessionEvent"];
  cwd?: () => string;
  env?: CliEnv;
  inspectSkill?: (options: InspectWCodeSkillOptions) => ReturnType<typeof inspectWCodeSkill>;
  inspectWorkspaceHookTrust?: typeof inspectWorkspaceHookTrust;
  grantWorkspaceHookTrust?: typeof grantWorkspaceHookTrust;
  revokeWorkspaceHookTrustCli?: typeof revokeWorkspaceHookTrustCli;
  inspectCustomCommand?: (
    options: InspectWCodeCustomCommandOptions,
  ) => ReturnType<typeof inspectWCodeCustomCommand>;
  loginWCodeCli?: (options?: LoginWCodeCliOptions) => ReturnType<typeof loginWCodeCli>;
  loginBigmodelCodingPlan?: (
    options?: LoginBigmodelCodingPlanOptions,
  ) => ReturnType<typeof loginBigmodelCodingPlan>;
  configureCodingPlanApiKey?: (
    options: ConfigureCodingPlanApiKeyOptions,
  ) => ReturnType<typeof configureCodingPlanApiKey>;
  loadDotenv?: (options?: LoadCliDotenvOptions) => DotenvLoadResult;
  prepareWCodeTelemetryEnv?: typeof prepareWCodeTelemetryEnv;
  projectConfigPath?: string;
  listSessions?: (options: ListWCodeSessionsOptions) => ReturnType<typeof listWCodeSessions>;
  listCustomCommands?: (
    options: ListWCodeCustomCommandsOptions,
  ) => ReturnType<typeof listWCodeCustomCommands>;
  loadCustomCommand?: (
    options: InspectWCodeCustomCommandOptions,
  ) => ReturnType<typeof loadWCodeCustomCommand>;
  // headless slash 路由要和 app facade 的保留名 gate 用同一个判据；默认取 bootstrap 的，
  // 注入点只为让单测不必拉起整个 bootstrap 模块。见 prompt-command.ts。
  isReservedSlashCommandName?: BootstrapModule["isReservedWCodeSlashCommandName"];
  listSkills?: (options: ListWCodeSkillsOptions) => ReturnType<typeof listWCodeSkills>;
  logger?: Logger;
  readClipboardImage?: TuiReadClipboardImage;
  writeClipboardText?: TuiWriteClipboardText;
  resolveLatestSession?: (
    options: ResolveLatestSessionOptions,
  ) => ReturnType<typeof resolveLatestSession>;
  resolveWorkspaceGitBranch?: typeof resolveWorkspaceGitBranch;
  logoutWCodeCli?: (options?: LogoutWCodeCliOptions) => ReturnType<typeof logoutWCodeCli>;
  runWCodeProtocolAgent?: (options?: RunWCodeProtocolAgentOptions) => Promise<void>;
  runTui?: typeof import("@wcode/tui").runTui;
  skipUserConfig?: boolean;
  userConfigPath?: string;
  exitProcess?: (code: number) => void;
  shutdownCleanupTimeoutMs?: number;
  shutdownProcess?: CliShutdownProcess;
  startProcessProviderRegistryRuntime?: typeof startProcessProviderRegistryRuntime;
  shutdownWCodeTelemetry?: typeof shutdownWCodeTelemetry;
}

export type CliPermissionMode = "build" | "plan" | "edit" | "yolo" | "guarded";
export type CliRuntimeMode = CliPermissionMode | "auto";

export interface CliModeState {
  current?: CliRuntimeMode;
  override?: CliPermissionMode;
}

export interface CliTargetRequest {
  objective: string;
  replaceExisting: boolean;
}

export type ModeCapableApp = Awaited<ReturnType<typeof createWCodeApp>> & {
  getMode?: () => CliRuntimeMode;
  setLocale?: (locale: UiLocale) => Promise<{ locale: "en-US" | "zh-CN" }>;
  setMode?: (mode: CliRuntimeMode) => Promise<{ mode: CliRuntimeMode }>;
};

export interface CliResumeRequest {
  continueSession: boolean;
  resumeSessionId?: string;
}
