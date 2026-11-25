// 分享网页运行在用户自己的浏览器里，版本不受我们控制。
// ZCT-2118215639243444224：Chrome 109 没有 Array.prototype.toSorted，Hook 详情组件渲染时抛
// TypeError，区域错误边界显示“这块界面出了点问题”。Vite 只降级语法、不补运行时 API，
// 这里只补产物实际用到、且高于构建语法基线的 API；core-js 会先检测原生实现，不覆盖新版浏览器。
// 必须放在最前面：ES module 按 import 顺序求值，其他模块执行前 API 需已就绪。
import "core-js/stable/array/to-sorted";
import "core-js/stable/array/to-reversed";
import "core-js/stable/object/group-by";
import { createWebPlatform } from "#src/platform/index.js";
import {
  matchesWebRemoteControlRoutePath,
  resolveWebRemoteControlRoutePathFromBaseUrl,
} from "@wcode/shared";
import { createRoot } from "react-dom/client";
import {
  AppErrorBoundary,
  Root,
  WCodeIntlProvider,
  generateMobileDeviceFingerprint,
  setStreamClientId,
} from "@wcode/ui";
import "./styles.css";
import { connectViaWebSocket } from "@wcode/client";

import { WebCallbackPage } from "./auth/WebCallbackPage.js";
import { createWebAuthService } from "./auth/webAuthService.js";
import { WEB_ZAI_OAUTH_CONFIG, resolveWebAuthDevReturnTo } from "./auth/webZaiOAuthConfig.js";
import {
  ConversationShareLandingLoader,
  ConversationShareLandingStatus,
} from "./share/ConversationShareLandingPage.js";
import {
  ConversationSharePreviewClient,
  resolveConversationShareRouteLocale,
} from "./share/conversationSharePreviewClient.js";
import {
  isConversationSharePath,
  resolveConversationShareCodeFromPath,
} from "./share/conversationShareRoute.js";
import { resolveWebThemePreference } from "./webThemePreference.js";
import type { ServerRemoteInfo } from "@wcode/shared";

// 初始化主题：默认跟随系统外观，后续由 useTheme hook 接管。
// 显式选择过的主题仍以 localStorage 为准；system 模式需要查询系统偏好。
{
  // 分享页是公开落地页，未设置过主题时固定浅色；其他 Web 页面默认跟随系统。
  const saved = resolveWebThemePreference(
    isConversationSharePath(window.location.pathname) ? "zai-light" : undefined,
  );
  const resolved =
    saved === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : saved === "dark" || saved === "zai-dark"
        ? "dark"
        : "light";
  const appliedTheme =
    saved === "system"
      ? resolved === "dark"
        ? "zai-dark"
        : "zai-light"
      : saved === "dark"
        ? "zai-dark"
        : saved === "light"
          ? "zai-light"
          : saved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("theme-zai-light", appliedTheme === "zai-light");
  document.documentElement.classList.toggle("theme-zai-dark", appliedTheme === "zai-dark");
}

const root = createRoot(document.getElementById("root")!);
const webAuthService = createWebAuthService();
// 初始化 Web 端流式 clientId，确保所有 hook 在首次渲染前就使用稳定 ID
{
  setStreamClientId(generateMobileDeviceFingerprint());
}

interface WebBootstrapResult {
  wsUrl: string;
  /** 由 Server 依据客户端来源判定：本机模式才允许文件管理器 / 默认应用等本机专属入口。 */
  deploymentMode?: "local" | "server";
  initialWorkspaceAbsPath?: string;
  initialWorkspaceIdentity?: string;
  initialTaskId?: string;
  restoreSession?: boolean;
  allowOpenWorkspace?: boolean;
}

function isWebOAuthCallback(params: URLSearchParams): boolean {
  return (
    ["/cn/share/callback", "/share/callback"].includes(window.location.pathname) &&
    params.has("state") &&
    // BigModel 的 authCode 要先进入回调页，才能由 provider 归一化为 code。
    (params.has("code") || params.has("authCode") || params.has("error"))
  );
}

function renderWebAuthCallbackPage(): void {
  document.title = "WCode - Sign In";
  // 区域登录的 state 来自服务端，回跳地址只记在 pending 里；必须在 handleCallback 取出前读取。
  const safeRetryTarget = webAuthService.resolveCallbackReturnTo(window.location.href);
  root.render(
    <WebCallbackPage
      authService={webAuthService}
      onSuccess={({ appReturnTo }) => {
        window.location.replace(appReturnTo ?? "/");
      }}
      onRetry={() => {
        window.location.replace(safeRetryTarget ?? "/");
      }}
    />,
  );
}

async function renderConversationSharePage(): Promise<void> {
  // 页面语言跟随路径前缀：/cn/share 中文，裸 /share 英文。
  const routeLocale = resolveConversationShareRouteLocale(window.location.pathname);
  // index.html 固定 lang="en"；不同步会让中文分享页对无障碍与浏览器翻译都报错语言。
  document.documentElement.lang = routeLocale;
  // 分享页必须设置 title：否则浏览器标签只显示 index.html 的通用标题。
  // 会话标题要等 preview 加载完，先给一个语言正确的兜底。
  document.title = routeLocale === "zh-CN" ? "WCode 会话分享" : "WCode Conversation Share";
  const shareCode = resolveConversationShareCodeFromPath(window.location.pathname);
  if (!shareCode) {
    root.render(
      <ConversationShareLandingStatus
        state={{ kind: "error", error: "invalid_contract" }}
        locale={routeLocale}
      />,
    );
    return;
  }

  const endpointOrigin =
    import.meta.env.VITE_WCODE_BASE_URL?.trim().replace(/\/+$/u, "") || window.location.origin;
  const mockMode =
    import.meta.env.DEV && import.meta.env.VITE_CONVERSATION_SHARE_PREVIEW_MOCK === "true";
  // Share 加载失败不能只有通用 network 文案：需要区分 mock、endpoint 配置或跨域 fetch。
  // 这里只记录运行时路由与 endpoint，不记录完整 pathname，避免把 share code 写入日志。
  console.info("[conversation-share-web]", "preview_runtime_initialized", {
    browserOrigin: window.location.origin,
    routeKind: "canonical",
    endpointOrigin,
    transport: mockMode ? "mock" : "fetch",
  });
  const client = mockMode
    ? new (
        await import("./share/mockConversationSharePreviewClient.js")
      ).MockConversationSharePreviewClient()
    : new ConversationSharePreviewClient({ baseUrl: `${endpointOrigin}/api/v1` });
  const getMockToken = () =>
    mockMode && window.sessionStorage.getItem("wcode:share:mock-auth") === "owner"
      ? "mock-owner-token"
      : null;
  const onLogout = () => {
    if (mockMode) {
      window.sessionStorage.removeItem("wcode:share:mock-auth");
      window.location.reload();
      return;
    }
    void webAuthService.logout();
  };
  root.render(
    <ConversationShareLandingLoader
      shareCode={shareCode}
      client={client}
      getAccessToken={() => getMockToken() ?? webAuthService.getWCodeJwtToken()}
      onLogin={(provider, signal) => {
        if (mockMode) {
          window.sessionStorage.setItem("wcode:share:mock-auth", "owner");
          window.location.reload();
          return;
        }
        return webAuthService.startLogin({
          signal,
          provider,
          appReturnTo: window.location.href,
          redirectUri: WEB_ZAI_OAUTH_CONFIG.shareRedirectUri,
          devReturnTo: resolveWebAuthDevReturnTo(WEB_ZAI_OAUTH_CONFIG, "share"),
        });
      }}
      onLogout={onLogout}
      locale={routeLocale}
      theme={resolveWebThemePreference("zai-light")}
    />,
  );
}

// 访问 window.localStorage 本身在部分浏览器会抛错，统一包在方法里交给调用方兜底。
function resolveDefaultWsOrigin(): string {
  return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
}

async function resolveWebBootstrap(): Promise<WebBootstrapResult> {
  const params = new URLSearchParams(window.location.search);
  const remoteId = params.get("remote");
  const wsUrl = remoteId
    ? `${resolveDefaultWsOrigin()}/ws/remote/${remoteId}`
    : `${resolveDefaultWsOrigin()}/ws`;

  if (remoteId) {
    return { wsUrl };
  }

  try {
    const response = await fetch("/api/server-info", {
      cache: "no-store",
    });
    if (!response.ok) {
      return { wsUrl };
    }
    const serverInfo = (await response.json()) as Partial<ServerRemoteInfo>;
    const workspace = Array.isArray(serverInfo.workspaces) ? serverInfo.workspaces[0] : undefined;
    const deploymentMode = serverInfo.deployment?.mode;
    return {
      wsUrl,
      ...(deploymentMode ? { deploymentMode } : {}),
      ...(workspace?.path ? { initialWorkspaceAbsPath: workspace.path } : {}),
      ...(workspace?.workspaceIdentity
        ? { initialWorkspaceIdentity: workspace.workspaceIdentity }
        : {}),
    };
  } catch {
    return { wsUrl };
  }
}

/** Web 端只有主应用一个入口；启动失败时用最简页面呈现原因，不再依赖已下线的远控视图。 */
async function renderBootstrapError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  // WS 失败信息里不含状态码，直接探测受保护接口才能区分「服务未启动」与「缺少令牌」。
  let authRequired = false;
  try {
    const probe = await fetch("/api/server-info", { cache: "no-store" });
    authRequired = probe.status === 401;
  } catch {
    // 探测本身失败说明服务不可达，按通用启动失败处理。
  }
  document.title = "WCode";
  root.render(
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        {authRequired ? "需要访问令牌" : "WCode 启动失败"}
      </h1>
      <p style={{ color: "#b42318", marginBottom: 12 }}>{message}</p>
      <p style={{ color: "#666" }}>
        {authRequired
          ? "请用服务启动时打印的带 ?token= 的地址打开一次；服务端会写入会话 Cookie，之后无需再携带令牌。"
          : "请确认本机服务已启动，然后刷新页面。"}
      </p>
    </div>,
  );
}

async function bootstrapWebApp() {
  // 远控入口随桌面 Window Host 一并删除：旧书签与旧二维码直接回到主应用，不再渲染远控视图。
  // 路由与资源 base 分离：构建时注入的路由优先，未注入时沿用 BASE_URL 推导。
  const remoteRoutePath = resolveWebRemoteControlRoutePathFromBaseUrl(
    import.meta.env.VITE_WEB_REMOTE_CONTROL_ROUTE_PATH?.trim() || import.meta.env.BASE_URL,
  );
  if (
    matchesWebRemoteControlRoutePath(window.location.pathname, "/remote/v4") ||
    matchesWebRemoteControlRoutePath(window.location.pathname, remoteRoutePath)
  ) {
    window.location.replace("/");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (isWebOAuthCallback(params)) {
    renderWebAuthCallbackPage();
    return;
  }

  if (isConversationSharePath(window.location.pathname)) {
    await renderConversationSharePage();
    return;
  }

  let bootstrap: WebBootstrapResult;
  try {
    bootstrap = await resolveWebBootstrap();
  } catch (error) {
    await renderBootstrapError(error);
    return;
  }

  try {
    // Web 端不传 windowControllerService 能力开关：服务端没有 desktop Window Host，
    // 该通道不存在；accessor 会返回 undefined，任务操作自动走 wcodeTaskService 回退。
    const services = await connectViaWebSocket(bootstrap.wsUrl, {
      onClose: () => {},
    });
    // 能力探测只需一次：同时决定 canOpenLocalFiles 与「在 Finder 中打开」入口。
    const systemInfo = await services.systemService.info().catch(() => null);
    // 两个条件缺一不可：Server 所在机器要有图形文件管理器，且浏览器就在这台机器上。
    // 远端访问时这些操作会落在服务器上、用户看不到，因此按服务器模式关闭。
    const localMode = bootstrap.deploymentMode !== "server";
    const platform = createWebPlatform({
      canOpenLocalFiles: systemInfo?.canRevealPath === true && localMode,
      // 全部作用于 **Server 所在机器**：服务端会校验路径必须位于 workspace 根目录内。
      revealPath: (path) => services.systemService.revealPath(path),
      openPath: (path) => services.systemService.openPath(path),
      listEditors: () => services.systemService.listEditors(),
      openInEditor: (editorId, path) => services.systemService.openInEditor(editorId, path),
    });
    document.title = "WCode - Web + Server";

    root.render(
      <AppErrorBoundary>
        <WCodeIntlProvider
          settingService={services.settingService}
          broadcastService={services.broadcastService}
        >
          <Root
            services={services}
            platform={platform}
            initialWorkspaceAbsPath={bootstrap.initialWorkspaceAbsPath}
            initialWorkspaceIdentity={bootstrap.initialWorkspaceIdentity}
            initialTaskId={bootstrap.initialTaskId}
            restoreSession={bootstrap.restoreSession}
            allowOpenWorkspace={bootstrap.allowOpenWorkspace}
            preferDirectoryBrowser
            supportsEmbeddedBrowser={false}
            allowRemoteWorkspace={false}
          />
        </WCodeIntlProvider>
      </AppErrorBoundary>,
    );
  } catch (error) {
    await renderBootstrapError(error);
  }
}

void bootstrapWebApp();
