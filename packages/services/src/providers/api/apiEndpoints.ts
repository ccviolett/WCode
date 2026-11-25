import { buildRuntimeWCodeApiUrl, resolveZaiBusinessBaseUrl } from "@wcode/shared";

export const WCODE_CLIENT_SCENES_URL = buildRuntimeWCodeApiUrl(
  process.env,
  "/api/v1/client/scenes",
);

export const ZAI_API_HOST = resolveZaiBusinessBaseUrl(process.env);
