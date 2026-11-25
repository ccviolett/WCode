import {
  wcodeProtocolMethods,
  wcodePluginsReferenceCatalogResultSchema,
  type WCodePluginsReferenceCatalogParams,
} from "@wcode/shared";
import type { WCodeProtocolClient } from "#src/wcode-agent/wcodeProtocolClient.js";

/** 旧协议严格校验响应；新展示字段走独立入口，只有 -32601 能证明旧 Agent 不支持。 */
export async function requestPluginReferenceCatalog(
  client: Pick<WCodeProtocolClient, "request">,
  params: WCodePluginsReferenceCatalogParams,
) {
  try {
    return await client.request(
      wcodeProtocolMethods.pluginsReferenceCatalogWithCategory,
      params,
      wcodePluginsReferenceCatalogResultSchema,
    );
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === -32601))
      throw error;
    return client.request(
      wcodeProtocolMethods.pluginsReferenceCatalog,
      params,
      wcodePluginsReferenceCatalogResultSchema,
    );
  }
}
