import { DEFAULT_WCODE_ENDPOINT_ORIGIN } from "./wcodeEndpoint.js";

export const WCODE_SOURCE_HEADERS = {
  "User-Agent": "WCode/unknown",
  "HTTP-Referer": DEFAULT_WCODE_ENDPOINT_ORIGIN,
  "X-Title": "Z Code@electron",
} as const;

export interface BuildWCodeSourceHeadersFromContextOptions {
  appVersion?: string;
  arch?: string;
  clientLanguage?: string;
  clientTimezone?: string;
  deviceMid?: string;
  endpointOrigin?: string;
  osVersion?: string;
  platform?: string;
  releaseChannel?: string;
  sourceTitle?: string;
}

export function normalizeWCodeSourceHeaderValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^[\x20-\x7e]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function buildWCodeSourceHeadersFromContext(
  options: BuildWCodeSourceHeadersFromContextOptions = {},
): Record<string, string> {
  const appVersion = normalizeWCodeSourceHeaderValue(options.appVersion);
  const arch = normalizeWCodeSourceHeaderValue(options.arch);
  const clientLanguage = normalizeWCodeSourceHeaderValue(options.clientLanguage) ?? "unknown";
  const clientTimezone = normalizeWCodeSourceHeaderValue(options.clientTimezone) ?? "unknown";
  const deviceMid = normalizeWCodeSourceHeaderValue(options.deviceMid);
  const endpointOrigin =
    normalizeWCodeSourceHeaderValue(options.endpointOrigin) ?? DEFAULT_WCODE_ENDPOINT_ORIGIN;
  const osVersion = normalizeWCodeSourceHeaderValue(options.osVersion);
  const platform = normalizeWCodeSourceHeaderValue(options.platform);
  const releaseChannel = normalizeWCodeSourceHeaderValue(options.releaseChannel);
  const sourceTitle = normalizeWCodeSourceHeaderValue(options.sourceTitle) ?? "electron";

  return {
    ...WCODE_SOURCE_HEADERS,
    "HTTP-Referer": endpointOrigin,
    "User-Agent": `WCode/${appVersion ?? "unknown"}`,
    ...(appVersion ? { "X-WCode-App-Version": appVersion } : {}),
    "X-Title": `Z Code@${sourceTitle}`,
    ...(platform && arch ? { "X-Platform": `${platform}-${arch}` } : {}),
    ...(releaseChannel ? { "X-Release-Channel": releaseChannel } : {}),
    "X-Client-Language": clientLanguage,
    "X-Client-Timezone": clientTimezone,
    ...(platform ? { "X-Os-Category": normalizeOsCategory(platform) } : {}),
    ...(osVersion ? { "X-Os-Version": osVersion } : {}),
    ...(deviceMid ? { "X-Device-Mid": deviceMid } : {}),
  };
}

function normalizeOsCategory(platform: string): string {
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}
