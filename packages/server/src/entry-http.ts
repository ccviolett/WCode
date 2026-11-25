import {
  createServerHostServices,
  createTopicResourcePeers,
  getAppConfigDir,
} from "@wcode/services/node";
import {
  materializeBundledWCodeBuiltinProviderConfig,
  readBundledWCodeBuiltinProviderConfig,
} from "./bundledWCodeBuiltinProviderConfig.js";
import { createHttpServer, resolveHttpServerId } from "./http.js";

async function main(): Promise<void> {
  const wcodeBuiltinProviderConfigFilePath = await materializeBundledWCodeBuiltinProviderConfig({
    environmentConfigRoot: getAppConfigDir(),
    content: readBundledWCodeBuiltinProviderConfig(),
  });
  const port = Number(process.env["PORT"]) || 3030;
  const host = process.env["WCODE_SERVER_HOST"]?.trim() || process.env["HOST"]?.trim() || undefined;
  const staticRoot = process.env["WCODE_WEB_STATIC_ROOT"]?.trim() || undefined;
  const authToken = process.env["WCODE_SERVER_AUTH_TOKEN"]?.trim() || undefined;
  const topicResourcePeers = createTopicResourcePeers();
  const serverId = resolveHttpServerId();
  const { services, workspaceIdentityMapper, migrationFailedPathCount } =
    await createServerHostServices({
      topicResourceRelayChannel: (request) => topicResourcePeers.getChannel(request),
      sourceServerId: serverId,
      wcodeBuiltinProviderConfigFilePath,
      providerProvisioningTargetEnabled: Boolean(authToken),
    });

  createHttpServer(services, port, {
    serverId,
    workspaceIdentityMapper,
    migrationFailedPathCount,
    virtualProjects: true,
    topicResourcePeers,
    ...(host ? { host } : {}),
    ...(staticRoot ? { staticRoot, spaFallback: true } : {}),
    ...(authToken ? { authToken, authRequired: true } : {}),
  });
}

void main().catch((error: unknown) => {
  console.error("[wcode-server:http] startup failed", error);
  process.exitCode = 1;
});
