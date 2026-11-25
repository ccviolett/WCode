import { z } from "zod";
import type { CommandAgentSource } from "./command-types.js";
import type { WCodeProvider } from "./wcode-task-types-core.js";

export const WCODE_AGENT_PROVIDER = "glm" satisfies WCodeProvider;
export const WCODE_AGENT_PROVIDER_LABEL = "WCode Agent";
export const WCODE_COMMAND_AGENT_SOURCE = "wcodeAgent" satisfies CommandAgentSource;

/**
 * 解析持久化/relay 数据时的 provider 归一 schema：
 * 已移除的第三方 provider 历史值仅作为归一化输入保留，统一收敛为 glm；
 * 其它非法值保持拒绝，与收窄前的校验边界一致。
 */
export const legacyWCodeProviderSchema = z
  .enum(["claude", "opencode", "gemini", "codex", "glm"])
  .transform((): typeof WCODE_AGENT_PROVIDER => WCODE_AGENT_PROVIDER);

export const WCODE_ENABLED_AGENT_PROVIDERS = [
  WCODE_AGENT_PROVIDER,
] as const satisfies readonly WCodeProvider[];

export const WCODE_COMMAND_AGENT_SOURCES = [
  WCODE_COMMAND_AGENT_SOURCE,
] as const satisfies readonly CommandAgentSource[];

export function normalizeAgentProviderToWCodeAgent(
  _provider?: WCodeProvider | null,
): WCodeProvider {
  return WCODE_AGENT_PROVIDER;
}

export function normalizeAgentProvidersToWCodeAgent(
  _providers?: ReadonlyArray<WCodeProvider> | null,
): WCodeProvider[] {
  return [...WCODE_ENABLED_AGENT_PROVIDERS];
}

export function normalizeCommandAgentSourceToWCodeAgent(
  _agentSource?: CommandAgentSource | null,
): CommandAgentSource {
  return WCODE_COMMAND_AGENT_SOURCE;
}

export function isWCodeAgentProvider(
  provider: WCodeProvider | null | undefined,
): provider is typeof WCODE_AGENT_PROVIDER {
  return provider === WCODE_AGENT_PROVIDER;
}
