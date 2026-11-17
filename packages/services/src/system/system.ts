import type {
  IntegratedTerminalShellOption,
  IntranetProbeRequest,
  IntranetProbeResult,
  SystemInfo,
} from "@wcode/shared";
import { ServiceChannels } from "@wcode/shared";
import { createServiceDescriptor } from "../descriptors.js";
import type { HostEditor, HostPathActionResult } from "./systemHostReveal.js";

export interface ISystemService {
  info(): Promise<SystemInfo>;
  listIntegratedTerminalShells(): Promise<IntegratedTerminalShellOption[]>;
  probeIntranet(request: IntranetProbeRequest): Promise<IntranetProbeResult>;
  /**
   * 在 **Server 所在机器** 的文件管理器中定位路径。
   * 仅限已登记 workspace 根目录内，且需要 WCODE_ALLOW_HOST_REVEAL 未显式关闭。
   */
  revealPath(path: string): Promise<HostPathActionResult>;
  /** 用 Server 所在机器的默认应用打开文件或目录；与 revealPath 共用 workspace 白名单。 */
  openPath(path: string): Promise<HostPathActionResult>;
  /** 宿主机可用的编辑器；Web 端据此决定是否显示「在 VS Code 中打开」。 */
  listEditors(): Promise<HostEditor[]>;
  /** 用指定编辑器打开路径；finder/explorer 退化为定位。 */
  openInEditor(editorId: string, path: string): Promise<HostPathActionResult>;
}

export const ISystemService = createServiceDescriptor<ISystemService>(ServiceChannels.System);
