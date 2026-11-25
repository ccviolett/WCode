import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WCodeStdioTapDevState } from "@wcode/shared";
import { getAppConfigDir } from "#src/paths.js";
import { isEffectiveDevelopmentNodeEnv } from "#src/runtime-tools/nodeEnv.js";

interface WCodeStdioTapStateFile {
  enabled?: boolean;
}

export function isWCodeStdioTapDevVisible(): boolean {
  return isEffectiveDevelopmentNodeEnv();
}

export function getWCodeStdioTapDevDir(): string {
  return join(getAppConfigDir(), "dev");
}

export function getWCodeStdioTapDevLogDir(): string {
  return join(getWCodeStdioTapDevDir(), "stdio-traffic");
}

export function getWCodeStdioTapDevStatePath(): string {
  return join(getWCodeStdioTapDevDir(), "wcode-stdio-tap.json");
}

function readStateFile(path: string): WCodeStdioTapStateFile {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as WCodeStdioTapStateFile) : {};
  } catch {
    return {};
  }
}

export function readWCodeStdioTapDevState(): WCodeStdioTapDevState {
  const visible = isWCodeStdioTapDevVisible();
  const statePath = getWCodeStdioTapDevStatePath();
  const fileState = readStateFile(statePath);
  return {
    enabled: visible && fileState.enabled === true,
    visible,
    logDir: getWCodeStdioTapDevLogDir(),
    statePath,
  };
}

export function setWCodeStdioTapDevEnabled(enabled: boolean): WCodeStdioTapDevState {
  const visible = isWCodeStdioTapDevVisible();
  const statePath = getWCodeStdioTapDevStatePath();
  mkdirSync(getWCodeStdioTapDevDir(), { recursive: true });
  writeFileSync(
    statePath,
    `${JSON.stringify(
      {
        // 开发态 stdio 抓包是高频原始协议帧，只能通过显式开关写旁路文件，避免误进生产日志。
        enabled: visible && enabled,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  return readWCodeStdioTapDevState();
}
