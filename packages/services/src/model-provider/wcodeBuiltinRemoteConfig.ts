import { downloadWCodeBuiltinRelease, type WCodeBuiltinDownloadResult } from "@wcode/provider-node";
import type { ApiClient, WCodeJwtTokenResolver } from "@wcode/shared";

export interface FetchWCodeBuiltinRemoteReleaseOptions {
  readonly apiClient: ApiClient;
  readonly endpointOrigin: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly signal?: AbortSignal;
  readonly resolveWcodeJwtToken?: WCodeJwtTokenResolver;
  readonly reuseUrl?: string;
}

/** Services 仅注入既有网络装配；URL、预算与 Release 校验由 provider-node 唯一实现。 */
export async function fetchWCodeBuiltinRemoteRelease(
  options: FetchWCodeBuiltinRemoteReleaseOptions,
): Promise<WCodeBuiltinDownloadResult> {
  return downloadWCodeBuiltinRelease({
    endpointOrigin: options.endpointOrigin,
    appVersion: options.appVersion,
    platform: options.platform,
    signal: options.signal,
    resolveWcodeJwtToken: options.resolveWcodeJwtToken,
    request: (url, init) => options.apiClient.request(url, init),
    ...(options.reuseUrl ? { reuseUrl: options.reuseUrl } : {}),
  });
}
