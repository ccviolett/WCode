import { randomBytes } from "node:crypto";
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
  // `WCODE_SERVER_TOKEN` 是历史名，和 `WCODE_SERVER_AUTH_TOKEN` 等价，两个都认。
  const configuredToken =
    process.env["WCODE_SERVER_AUTH_TOKEN"]?.trim() ||
    process.env["WCODE_SERVER_TOKEN"]?.trim() ||
    undefined;
  // 只有**显式**把监听地址设成非回环时才视为对外暴露。
  // host 未设置时是 dev / 本机默认形态（Node 绑定全部网卡，但只供本机访问），
  // 若也强制发令牌，会让 `pnpm dev:web` 和默认 `wcode --web` 立刻 401。
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  const exposedToNetwork = Boolean(host) && !loopbackHosts.has(host!);
  const generatedToken =
    !configuredToken && exposedToNetwork ? randomBytes(24).toString("hex") : undefined;
  const authToken = configuredToken ?? generatedToken;
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

  if (!host && !configuredToken) {
    // 未指定监听地址时 Node 绑定全部网卡；本地开发没问题，但同网段可直接访问，
    // 因此显式提示，而不是悄悄放开。需要对外访问请同时设置 host 与令牌。
    console.warn(
      "[wcode-server] 未指定 WCODE_SERVER_HOST：服务监听全部网卡且未启用访问令牌，仅建议本机使用。" +
        "对外访问请显式设置 host 并配置 WCODE_SERVER_AUTH_TOKEN。",
    );
  }

  if (generatedToken) {
    // 一次性引导令牌只打印到当前终端（stdout），不落盘、不写入任何日志文件。
    // 浏览器首次用它打开页面后，服务端写入 HttpOnly 会话 Cookie 并 302 去掉 URL 中的 token；
    // 之后同一浏览器不再需要携带令牌。设置 WCODE_SERVER_AUTH_TOKEN 可固定令牌。
    const displayHost = !host || host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
    console.log(
      [
        "[wcode-server] 未配置访问令牌且监听非回环地址，已生成本次启动的一次性令牌：",
        `  http://${displayHost}:${port}/?token=${generatedToken}`,
        "  打开一次后由 Cookie 维持会话；如需固定令牌，请设置 WCODE_SERVER_AUTH_TOKEN。",
      ].join("\n"),
    );
  }
}

void main().catch((error: unknown) => {
  console.error("[wcode-server:http] startup failed", error);
  process.exitCode = 1;
});
