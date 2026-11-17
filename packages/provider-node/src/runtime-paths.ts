export const WCODE_BUILTIN_PROVIDER_CONFIG_FILE_ENV = "WCODE_BUILTIN_PROVIDER_CONFIG_FILE";
export const WCODE_BUILTIN_PROVIDER_BUNDLED_CONFIG_FILE_ENV =
  "WCODE_BUILTIN_PROVIDER_BUNDLED_CONFIG_FILE";
export const WCODE_PERSONAL_PROVIDER_CONFIG_FILE_ENV = "WCODE_PERSONAL_PROVIDER_CONFIG_FILE";
export const PERSONAL_PROVIDER_CONFIG_FILE_NAME = "provider_config.json";

export interface NodeProviderRuntimePaths {
  readonly wcodeBuiltinFilePath: string;
  readonly personalFilePath: string;
}

export function createNodeProviderRuntimePathEnv(
  paths: NodeProviderRuntimePaths,
): Record<string, string> {
  return {
    [WCODE_BUILTIN_PROVIDER_CONFIG_FILE_ENV]: paths.wcodeBuiltinFilePath,
    [WCODE_PERSONAL_PROVIDER_CONFIG_FILE_ENV]: paths.personalFilePath,
  };
}

export function resolveNodeProviderRuntimePaths(
  env: Readonly<Record<string, string | undefined>>,
): NodeProviderRuntimePaths | null {
  const wcodeBuiltinFilePath = env[WCODE_BUILTIN_PROVIDER_CONFIG_FILE_ENV]?.trim();
  const personalFilePath = env[WCODE_PERSONAL_PROVIDER_CONFIG_FILE_ENV]?.trim();
  if (!wcodeBuiltinFilePath && !personalFilePath) return null;
  if (!wcodeBuiltinFilePath || !personalFilePath) {
    throw new Error("WCode Built-in 与 Personal Provider Config 路径必须同时提供");
  }
  return Object.freeze({ wcodeBuiltinFilePath, personalFilePath });
}
