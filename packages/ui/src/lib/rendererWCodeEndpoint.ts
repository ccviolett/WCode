import {
  buildRuntimeWCodeEndpointUrls,
  WCODE_ENV,
  type RuntimeWCodeEndpointEnv,
} from "@wcode/shared";

interface RendererImportMetaEnv {
  VITE_WCODE_BASE_URL?: string;
  VITE_WCODE_ENDPOINT_ORIGIN?: string;
}

function readRendererImportMetaEnv(): RendererImportMetaEnv {
  return ((import.meta as ImportMeta & { env?: RendererImportMetaEnv }).env ??
    {}) as RendererImportMetaEnv;
}

export function createRendererWCodeEndpointEnv(
  env: RendererImportMetaEnv = readRendererImportMetaEnv(),
): RuntimeWCodeEndpointEnv {
  return {
    WCODE_ENV,
    // UI 侧的 wcode-plan 占位 provider 以前只看 WCODE_ENV，
    // 没有消费 Vite 注入的 base url，导致自定义测试域名时 renderer 和 host/service 可能不一致。
    WCODE_BASE_URL: env.VITE_WCODE_BASE_URL,
    WCODE_ENDPOINT_ORIGIN: env.VITE_WCODE_ENDPOINT_ORIGIN,
  };
}

export const RENDERER_WCODE_ENDPOINT_URLS = buildRuntimeWCodeEndpointUrls(
  createRendererWCodeEndpointEnv(),
);
