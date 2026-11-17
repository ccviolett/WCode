import { z } from "zod";
import {
  parseWCodeBuiltinModelConfigRules,
  parseWCodeBuiltinProviderConfigRules,
  type ModelConfigRules,
  type ProviderConfigMap,
  type ProviderTemplateMap,
} from "@wcode/provider";

export const WCODE_BUILTIN_RELEASE_SCHEMA_VERSION = 1 as const;
const RETIRED_ZAPI_PROVIDER_ID = "builtin:zapi";

export interface WCodeBuiltinConfigContent {
  readonly providers: ProviderConfigMap;
  readonly providerTemplates: ProviderTemplateMap;
  readonly modelConfigRules: ModelConfigRules;
}

export interface WCodeBuiltinRelease {
  readonly schemaVersion: typeof WCODE_BUILTIN_RELEASE_SCHEMA_VERSION;
  readonly revision: number;
  readonly config: WCodeBuiltinConfigContent;
}

const releaseSchema = z
  .object({
    schemaVersion: z.literal(WCODE_BUILTIN_RELEASE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    config: z
      .object({
        providerConfigRules: z.unknown(),
        modelConfigRules: z.unknown(),
      })
      .strict(),
  })
  .strict();

export function decodeWCodeBuiltinRelease(input: unknown): WCodeBuiltinRelease {
  const parsed = releaseSchema.parse(input);
  const { providers, providerTemplates } = parseWCodeBuiltinProviderConfigRules(
    parsed.config.providerConfigRules,
  );
  // ZAPI 已退出产品，旧 Remote Release 或 LKG 不能在 Renderer 静态入口删除后
  // 又通过目标 Host Registry 将它重新发布。拒绝整份不兼容 Release，让 Source 回落到兼容候选。
  if (providers.has(RETIRED_ZAPI_PROVIDER_ID)) {
    throw new Error(`WCode Built-in Release 包含已退出的 Provider: ${RETIRED_ZAPI_PROVIDER_ID}`);
  }
  return Object.freeze({
    schemaVersion: WCODE_BUILTIN_RELEASE_SCHEMA_VERSION,
    revision: parsed.revision,
    config: Object.freeze({
      providers,
      providerTemplates,
      modelConfigRules: parseWCodeBuiltinModelConfigRules(parsed.config.modelConfigRules),
    }),
  });
}

export function encodeWCodeBuiltinRelease(release: WCodeBuiltinRelease): object {
  return {
    schemaVersion: WCODE_BUILTIN_RELEASE_SCHEMA_VERSION,
    revision: release.revision,
    config: {
      providerConfigRules: {
        templateRules: release.config.providerTemplates.toJSON(),
        providerRules: release.config.providers.toJSON(),
      },
      modelConfigRules: release.config.modelConfigRules.toWCodeBuiltinJSON(),
    },
  };
}

export function serializeWCodeBuiltinRelease(release: WCodeBuiltinRelease): string {
  return JSON.stringify(encodeWCodeBuiltinRelease(release));
}
