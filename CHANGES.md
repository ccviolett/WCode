# 变更说明（WCode fork）

本文件记录 WCode 相对于上游 ZCode 的修改，供分发时履行 Apache License 2.0 第 4(b) 条的
"标注修改"义务，也用于后续发版时生成发布说明。

## 来源

| 项         | 值                                                                |
| ---------- | ----------------------------------------------------------------- |
| 上游项目   | [zai-org/ZCode](https://github.com/zai-org/ZCode)                 |
| 上游版本   | v3.18.2（`package.json` version `3.18.2`）                        |
| 基线提交   | `fec97590`（`chore: sync ZCode source v3.18.2`）                  |
| 许可证     | Apache License 2.0（见 [LICENSE](LICENSE)），本分支沿用同一许可证 |
| 本分支名称 | WCode                                                             |

本仓库是上游源码的修改版，不是 Z.ai 官方项目，未获得其背书或赞助。
上一版 fork 基于 v3.17.2；本版是**重新派生**（在新基线上重放改动），不是与旧分支 merge。

## 一、平台裁剪

- 移除 Electron 桌面端：删除 `packages/desktop`（main / host / preload / renderer 与桌面打包）、
  `docs/desktop`、桌面专用构建与调试脚本（`dev-desktop-*`、`build-desktop-agent-*`、
  `stage-credential-keyring`、桌面 E2E 容器镜像与 `.vscode` 桌面调试配置等）、
  桌面专属补丁（`@arms/rum-electron`、`wdio-electron-service`）。
- 移除依赖桌面 Window Host 的入口：`/remote` 路由与 `packages/web/src/web-remote-control` 全部实现，
  以及与之对应的 `packages/web/test/e2e/remote-control` 浏览器验收脚本。此类操作在桌面端删除后
  没有可附着的 Host；旧书签与旧二维码跳回 `/`。
- 测试与工程门禁同步收敛：`scripts/engineering-test-files.json` 只保留非桌面工程测试，
  `vitest.config.ts` 去掉 `@desktop` 与 ARMS stub 别名，`Dockerfile.desktop-e2e`、
  `.agents/skills/e2e-case-lifecycle` 与桌面浏览器控制范围集成测试一并删除。
- 仓库形态收敛为：**浏览器 Web 端 + HTTP/WS 服务端 + Agent CLI/运行时**。

## 二、品牌与标识

- 包作用域 `@zcode/*` → `@wcode/*`；CLI bin `zcode` → `wcode`；根包名 `zcode` → `wcode`。
- 环境变量前缀 `ZCODE_*` → `WCODE_*`；数据目录 `~/.zcode` → `~/.wcode`（**不做迁移**，旧数据保持原样）。
- 目录与文件：`apps/zcode-cli` → `apps/wcode-cli`、`packages/zcode-cua` → `packages/wcode-cua`、
  `packages/zcode-server-cli` → `packages/wcode-server-cli`、`zcode-protocol*` → `wcode-protocol*`、
  `.zcode-plugin` → `.wcode-plugin` 等。
- 命令：`pnpm build:zcode` → `pnpm build:wcode`，`scripts/build-wcode.mjs`。
- 品牌图形：应用 Logo 由 Z 字形改为同风格 W 字形（同一圆角方块、同一粗斜线几何）；
  同步更新启动页与关于页矢量、空状态水印 `packages/ui/src/assets/W.svg`。Z.ai 作为供应商的图标保持原样。
- **保留未改（外部服务契约）**：上游服务域名（`zcode.z.ai`、`cdn-zcode.z.ai`、`zcode.ai`）以及上游路径段与外部包名（`/api/v1/zcode-plan/*`、`zcode\.z\.ai` `baseUrlMatch`、`cdn-zcode.z.ai/zcode/official-plugin/*` 含 `zcode-guide`/`zcode-cua`/`zcode-site` 图标、内网镜像 `/zcode/deps`、上游 PyPI 包名 `zcode-cua`）。这些是外部服务/分发契约，改名会导致登录、计费、模型能力匹配与插件市场 404；如需指向自建后端，请通过 `WCODE_BASE_URL`、`WCODE_DEPS_BASE_URL` 等配置项切换。

## 三、Web 独立运行改造

- 新增宿主机能力（客户端与服务同机、且宿主有图形界面时可用）：`system.revealPath`
  （在文件管理器中定位）、`system.openPath`（默认应用打开）、`system.listEditors` /
  `system.openInEditor`（VS Code）。实现在 `packages/services/src/system/systemHostReveal.ts`，
  按 workspace 根目录白名单校验（realpath 比较，防符号链接越界），`WCODE_ALLOW_HOST_REVEAL=0` 可整体关闭。
- 白名单覆盖 **全部已登记项目根**，不只 Server 当前工作区；多工作区场景下其他项目不再报
  `host-reveal-outside-workspace`。
- `SystemInfo.canRevealPath` 与 `IPlatformService.canOpenLocalFiles` 成为同一条能力判定：
  文件树、任务菜单、消息卡片与「在 Finder 中打开」不再各自判断，避免同一能力一处可用一处禁用。
- 服务端判定 `deployment.mode`（local / server）：出现代理转发头视为远端，其余按对端是否回环判断，
  可用 `WCODE_DEPLOYMENT_MODE` 显式覆盖。远端访问时本机专属入口自动关闭（这些操作会落在服务器上、
  用户看不到结果）。
- `window-controller` 在客户端改为**可选**能力：Web 端不创建该代理，任务归档/置顶/重命名与
  未读信号回退到 `wcodeTaskService`；桌面端若恢复可显式开启。
- Web 端默认主题改为跟随系统外观（原默认固定 Zai dark），并保留用户已保存的偏好。
- Web/Server Host 动态工作流缺省提供模式（`DEFAULT_DYNAMIC_WORKFLOW_MODE`）在未连接上游配置服务或无远端下发时改为 `onDemand`：默认保留 `/workflow` 命令与自动化页「工作流」入口，且不在普通聊天会话预注册 10 个工作流工具；仍遵循 `WCODE_DYNAMIC_WORKFLOW_MODE`、远端配置与用户设置覆盖。
- Web 端查看动态工作流 HTML 产物时，本机模式通过宿主机 `system.openPath` 调用系统默认浏览器打开工作区原文件，远端模式隐藏不可用的 `file://` 打开按钮并回退至工作区文件树定位。

## 四、访问控制

- 显式监听非回环地址且未配置令牌时，启动自动生成**一次性令牌**并打印带 `?token=` 的地址。
- 首次以文档导航访问时写入 HttpOnly 会话 Cookie 并 302 去掉 URL 中的令牌，
  后续请求（含 WebSocket）不再需要携带令牌；令牌不再残留在浏览器历史与 Referer 中。
- 支持 `Authorization: Bearer` 与 `WCODE_SERVER_AUTH_TOKEN`（兼容历史名 `WCODE_SERVER_TOKEN`）固定令牌；
  回环地址默认不启用鉴权。反向代理终止 TLS 时 Cookie 追加 `Secure`。

## 五、发布与依赖

- `build:wcode` 组装发行包时剔除全部 `.map`（终端用户不需要调试产物，体积明显下降）。
- 发行包根目录自动随附 `LICENSE`、`NOTICE.md`、`CHANGES.md`、`THIRD-PARTY-NOTICES.md`。
- `build:wcode` 随 `agent/wcode.cjs` 一并校验并打包 `agent/packages/bundled-skills`（`dynamic-workflows` 内置技能包），确保脱离源码目录运行时 `/workflow` 与工作流工具链的技能门可用。
- 删除桌面端遗留的 `package-lock.json`（pnpm 项目不使用），lockfile 与 workspace 链接按 `@wcode`
  作用域重建。
- 依赖集变化：不再包含 Electron、WebdriverIO、`@arms/rum-electron` 等桌面依赖。

## 六、升级注意事项

- 包作用域与数据目录均已变更，升级需重新 `pnpm install`；旧 `~/.zcode` 数据不会自动迁移。
- 上一版 fork 的 `packages/web/src/web-remote-control` 已删除；依赖该目录的内部脚本需同步调整。
- 发布新版本时请同步更新本文件与 `THIRD-PARTY-NOTICES.md`（见 [third-party/README.md](third-party/README.md)）。
