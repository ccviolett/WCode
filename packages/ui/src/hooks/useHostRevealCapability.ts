import { usePlatform } from "./usePlatform.js";

/**
 * Server 所在机器是否支持「在文件管理器中打开」这类本机专属操作。
 *
 * 判定收敛到 `IPlatformService.canOpenLocalFiles` 单一来源：它由 Server 依据
 * 「客户端是否来自本机」与「宿主是否有图形文件管理器」合成，桌面端恒为可用。
 * 此前这里另做一次 RPC 探测，与文件树、消息卡片各自判断，导致同一能力出现
 * 「一个入口可用、另一个入口禁用」的矛盾；统一读取平台能力后不再分叉。
 */
export function useHostRevealCapability(): boolean {
  const platform = usePlatform();
  return Boolean(platform.canOpenLocalFiles);
}
