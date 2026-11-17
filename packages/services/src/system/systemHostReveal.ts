import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 宿主机文件操作的结果；失败原因用于 UI 提示与诊断。 */
export interface HostPathActionResult {
  success: boolean;
  error?: string;
}

/** 宿主机检测到的可用编辑器。 */
export interface HostEditor {
  id: string;
  name: string;
}

export interface HostPathOptions {
  /** 显式开关（WCODE_ALLOW_HOST_REVEAL）；关闭时一律拒绝。 */
  enabled: () => boolean;
  /** 允许操作的根目录；路径必须落在其中之一，避免任意路径探测。 */
  roots: () => Promise<readonly string[]>;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  run?: (command: string, args: readonly string[]) => Promise<void>;
}

/** VS Code 在各平台的启动定义；仅在检测到安装时才会出现在编辑器列表。 */
const VSCODE_LAUNCH = {
  darwin: { command: "open", argsPrefix: ["-a", "Visual Studio Code"] },
  win32: { command: "cmd", argsPrefix: ["/c", "code"] },
  linux: { command: "code", argsPrefix: [] },
} as const;

const VSCODE_DARWIN_APP = "/Applications/Visual Studio Code.app";

/**
 * 宿主机是否存在可视文件管理器。
 * Web 端不再有 Electron，但 Server 可能就跑在用户自己的 macOS / Windows / 图形化 Linux 上；
 * headless Linux 上调用只会静默失败，因此直接判定为不可用，让 UI 隐藏入口。
 */
export function canRevealOnHost(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (platform === "darwin" || platform === "win32") return true;
  if (platform !== "linux") return false;
  return Boolean(env.DISPLAY?.trim() || env.WAYLAND_DISPLAY?.trim());
}

function resolveRevealCommand(
  platform: NodeJS.Platform,
  targetPath: string,
): { command: string; args: string[] } {
  if (platform === "darwin") {
    // -R 在 Finder 中选中该项并打开其父目录，文件与目录都适用。
    return { command: "open", args: ["-R", targetPath] };
  }
  if (platform === "win32") {
    // explorer 成功时也可能返回非 0 退出码，调用方按"已发起"处理。
    return { command: "explorer", args: [`/select,${targetPath}`] };
  }
  // Linux 没有通用的"选中"语义，退化为打开父目录。
  return { command: "xdg-open", args: [dirname(targetPath)] };
}

function resolveOpenCommand(
  platform: NodeJS.Platform,
  targetPath: string,
): { command: string; args: string[] } {
  if (platform === "darwin") return { command: "open", args: [targetPath] };
  // 空字符串是 start 的窗口标题占位，缺省会吞掉路径。
  if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", targetPath] };
  return { command: "xdg-open", args: [targetPath] };
}

async function isInsideRoots(targetPath: string, roots: readonly string[]): Promise<boolean> {
  // 必须用 realpath 比较：只有解析掉符号链接与 .. 之后，才能判断是否越出工作区。
  const realTarget = await realpath(targetPath);
  for (const root of roots) {
    let realRoot: string;
    try {
      realRoot = await realpath(root);
    } catch {
      continue;
    }
    const rel = relative(realRoot, realTarget);
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return true;
  }
  return false;
}

type GuardResult = { ok: true; target: string } | { ok: false; error: string };

/** 所有宿主机路径操作共用同一道闸：开关、GUI、绝对路径、存在性、workspace 白名单。 */
async function guardHostPath(options: HostPathOptions, path: string): Promise<GuardResult> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (!options.enabled()) return { ok: false, error: "host-reveal-disabled" };
  if (!canRevealOnHost(platform, env)) return { ok: false, error: "host-gui-unavailable" };

  const trimmed = typeof path === "string" ? path.trim() : "";
  if (!trimmed || !isAbsolute(trimmed)) {
    return { ok: false, error: "host-reveal-absolute-path-required" };
  }
  const targetPath = resolve(trimmed);
  try {
    await stat(targetPath);
  } catch {
    return { ok: false, error: "host-reveal-path-not-found" };
  }
  try {
    if (!(await isInsideRoots(targetPath, await options.roots()))) {
      return { ok: false, error: "host-reveal-outside-workspace" };
    }
  } catch {
    return { ok: false, error: "host-reveal-path-unresolved" };
  }
  return { ok: true, target: targetPath };
}

async function defaultRun(command: string, args: readonly string[]): Promise<void> {
  await execFileAsync(command, [...args], { windowsHide: true });
}

/**
 * 构造 system.revealPath 的实现。
 * 语义：在 **Server 所在机器** 的文件管理器中定位路径，而不是浏览器所在机器。
 */
export function createHostRevealPath(options: HostPathOptions) {
  const platform = options.platform ?? process.platform;
  const run = options.run ?? defaultRun;

  return async function revealPath(path: string): Promise<HostPathActionResult> {
    const guarded = await guardHostPath(options, path);
    if (!guarded.ok) return { success: false, error: guarded.error };
    const { command, args } = resolveRevealCommand(platform, guarded.target);
    try {
      await run(command, args);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

/**
 * 构造 system.openPath 的实现：用 **Server 所在机器** 的默认应用打开文件或目录。
 * 与 revealPath 共用白名单，避免 Web 页面借道执行任意程序。
 */
export function createHostOpenPath(options: HostPathOptions) {
  const platform = options.platform ?? process.platform;
  const run = options.run ?? defaultRun;

  return async function openPath(path: string): Promise<HostPathActionResult> {
    const guarded = await guardHostPath(options, path);
    if (!guarded.ok) return { success: false, error: guarded.error };
    const { command, args } = resolveOpenCommand(platform, guarded.target);
    try {
      await run(command, args);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

export interface HostEditorOptions {
  platform?: NodeJS.Platform;
  /** 注入存在性检查，便于在无 VS Code 环境验证。 */
  exists?: (path: string) => boolean;
}

/**
 * 检测宿主机已安装的编辑器。
 * 目前只识别 VS Code：它是 UI 编辑器菜单里唯一有明确跨平台启动约定的一项。
 */
export function listHostEditors(options: HostEditorOptions = {}): HostEditor[] {
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;
  if (platform === "darwin" && !exists(VSCODE_DARWIN_APP)) return [];
  // Windows/Linux 依赖 PATH 中的 code；无法可靠地在不执行命令的前提下探测，
  // 因此这里按"已安装"上报，真正执行失败时由 openInEditor 返回错误。
  return [{ id: "vscode", name: "Visual Studio Code" }];
}

export interface HostOpenInEditorOptions extends HostPathOptions {
  exists?: (path: string) => boolean;
}

/**
 * 构造 system.openInEditor 的实现。
 * finder/explorer 复用定位语义；vscode 走各平台启动命令。
 */
export function createHostOpenInEditor(options: HostOpenInEditorOptions) {
  const platform = options.platform ?? process.platform;
  const run = options.run ?? defaultRun;

  return async function openInEditor(
    editorId: string,
    path: string,
  ): Promise<HostPathActionResult> {
    const guarded = await guardHostPath(options, path);
    if (!guarded.ok) return { success: false, error: guarded.error };

    if (editorId === "finder" || editorId === "explorer") {
      const { command, args } = resolveRevealCommand(platform, guarded.target);
      try {
        await run(command, args);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    if (editorId !== "vscode") {
      return { success: false, error: "host-editor-unsupported" };
    }
    const launch = VSCODE_LAUNCH[platform as keyof typeof VSCODE_LAUNCH];
    if (!launch) return { success: false, error: "host-editor-unsupported" };
    try {
      await run(launch.command, [...launch.argsPrefix, guarded.target]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
