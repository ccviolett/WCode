import { access } from "node:fs/promises";
import { join } from "node:path";

export interface BundledAgentWiring {
  WCODE_AGENT_SERVER_COMMAND: string;
  WCODE_AGENT_SERVER_ARGS_JSON: string;
}

export function createReleaseAgentWiring(
  runtimeRoot: string,
  runtimeNode: string,
  env: Record<string, string | undefined>,
): BundledAgentWiring | null {
  if (env.WCODE_AGENT_SERVER_COMMAND?.trim()) return null;
  return {
    WCODE_AGENT_SERVER_COMMAND: runtimeNode,
    WCODE_AGENT_SERVER_ARGS_JSON: JSON.stringify([
      join(runtimeRoot, "wcode.cjs"),
      "app-server",
      "--stdio",
    ]),
  };
}

/**
 * 发行包内 Core 既不在 monorepo、也没有 Electron runtime，`wcodeAgentProcessManager`
 * 的默认解析链（monorepo dev → Electron → 远端已部署 binary）会全部落空。这里把随包
 * `wcode.cjs` 注入为 agent 启动命令；env 覆盖是该解析链的最高优先级，因此显式配置的
 * `WCODE_AGENT_SERVER_COMMAND` 永远优先，开发态（入口同目录无 wcode.cjs）不受影响。
 */
export async function resolveBundledAgentWiring(
  entryDir: string,
  env: Record<string, string | undefined>,
): Promise<BundledAgentWiring | null> {
  if (env.WCODE_AGENT_SERVER_COMMAND?.trim()) {
    return null;
  }
  const bundlePath = join(entryDir, "wcode.cjs");
  try {
    await access(bundlePath);
  } catch {
    return null;
  }
  return {
    WCODE_AGENT_SERVER_COMMAND: process.execPath,
    WCODE_AGENT_SERVER_ARGS_JSON: JSON.stringify([bundlePath, "app-server", "--stdio"]),
  };
}
