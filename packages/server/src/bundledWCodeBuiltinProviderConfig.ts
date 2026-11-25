import { materializeWCodeBuiltinProviderConfig } from "@wcode/services/node";

declare const __WCODE_BUILTIN_PROVIDER_CONFIG_JSON__: string | undefined;

export interface MaterializeBundledWCodeBuiltinProviderConfigOptions {
  readonly environmentConfigRoot: string;
  readonly content: string;
}

/** 返回构建时嵌入远端 Server 的 WCode Built-in Provider Config。 */
export function readBundledWCodeBuiltinProviderConfig(): string {
  if (typeof __WCODE_BUILTIN_PROVIDER_CONFIG_JSON__ !== "string") {
    throw new Error("当前构建未嵌入 WCode Built-in Provider Config");
  }
  return __WCODE_BUILTIN_PROVIDER_CONFIG_JSON__;
}

/**
 * 将 WCode Built-in Config 原子物化到所属环境的固定资源副本。
 * 升级前退出旧进程；不保留按内容 hash 增长的历史文件。
 */
export async function materializeBundledWCodeBuiltinProviderConfig(
  options: MaterializeBundledWCodeBuiltinProviderConfigOptions,
): Promise<string> {
  return materializeWCodeBuiltinProviderConfig(options);
}
