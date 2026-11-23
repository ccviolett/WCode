# WCode

<div align="center">
  <img src="public/logo/icons/1024x1024.png" alt="WCode" width="120" height="120" />
</div>

<p align="center">
  简体中文 | <a href="README.en.md">English</a>
</p>

<p align="center">
  基于 <a href="https://github.com/zai-org/ZCode">zai-org/ZCode</a>（<code>v3.18.2</code>）派生的纯 Web、独立 Server 与 Agent CLI/TUI 轻量化分支
</p>

---

WCode 面向 **本地浏览器、局域网与云服务器自托管** 场景，在保留完整 Web 工作台与 Agent CLI/TUI 能力的前提下，彻底移除 Electron 桌面端耦合，并围绕 Web 独立运行、安全访问控制、动态工作流开箱体验与轻量分发进行了系统化改造。

> **关于上游原项目**：ZCode 的原生 AI 编程能力、Agent 运行时理念与通用功能说明，请直接查阅上游仓库 [zai-org/ZCode](https://github.com/zai-org/ZCode)。本文档聚焦 **WCode 相对 ZCode 的核心优化** 与 **本仓库的实际使用方式**。

## 相对 ZCode 的核心优化

| 维度                         | 上游 ZCode                                                                          | WCode 优化                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **运行形态与体积**           | 包含 Electron 桌面端、`packages/desktop`、`/remote` 桌面远控及大量桌面构建/E2E 依赖 | **纯 Web + 独立 HTTP/WS Server + Agent CLI/TUI**；彻底移除桌面端、`/remote` 远控及 Electron/WDIO/`@arms/rum-electron` 等依赖，`window-controller` 降为可选能力                                                                                                                                                   |
| **Web 独立运行与宿主机能力** | Web 侧文件定位/打开能力依赖桌面宿主或各入口分散判断；默认固定暗色主题               | 服务端自动判定 `deployment.mode`（`local` / `server`）；同机图形宿主开放 `realpath` 白名单保护（覆盖全部已登记项目根）的 Finder/资源管理器定位、默认应用与 VS Code 打开，远端访问自动隐藏本机专属入口；默认主题跟随系统外观；Web 开发默认端口 `5183`                                                             |
| **服务端安全鉴权**           | 非回环访问需手动管理长期令牌，URL 携带令牌易留存在浏览器历史与 Referer              | 监听非回环地址且未配固定令牌时自动生成**一次性访问令牌**，首次打开写入 `HttpOnly` 会话 Cookie（TLS 反代下自动追加 `Secure`）并 `302` 清除 URL 中的 token；兼容 `Authorization: Bearer` 与 `WCODE_SERVER_AUTH_TOKEN`                                                                                              |
| **Web 端动态工作流（DWF）**  | 离线/无远端下发时默认关闭或依赖远端开关；产物打开偏桌面 `file://` 路径              | 离线/无远端下发时缺省模式改为 `onDemand`（默认保留 `/workflow` 与「自动化 › 工作流」入口，且不污染普通对话工具集）；HTML 产物本机可直开系统浏览器、远端平滑回退文件树定位；发行包内置 `bundled-skills`；附带中文全景定义与边界图解指南                                                                           |
| **统一轻量发行包**           | 桌面安装包与 CLI 分离，产物携带全部 `.map` 调试文件                                 | `pnpm build:wcode` 产出统一 `wcode` 单入口（`wcode` 启动 TUI，`wcode --web` 启动 Web），自动剔除全部 `.map` 减小包体，校验并随包打包 `agent/packages/bundled-skills` 及 Apache-2.0 合规四件套                                                                                                                    |
| **品牌隔离与外部契约保护**   | 共享 `@zcode/*`、`~/.zcode` 与 `ZCODE_*` 命名空间                                   | 内部包作用域（`@wcode/*`）、CLI（`wcode`）、环境变量（`WCODE_*`）、数据目录（`~/.wcode/v2/`）与 W 字形 Logo 彻底隔离；**同时严格保留上游外部服务契约**（`zcode.z.ai`、`/api/v1/zcode-plan/*`、`cdn-zcode.z.ai/zcode/official-plugin/*`、`/zcode/deps`、`zcode-cua`），确保官方账号登录、套餐校验与插件市场无 404 |

完整变更明细与升级注意事项见 [CHANGES.md](CHANGES.md)。

### 几项关键改进说明

- **本机与远端自动分层**：服务端根据代理转发头与对端回环地址自动判定 `deployment.mode`（可用 `WCODE_DEPLOYMENT_MODE` 显式覆盖）。本机通过浏览器使用时体验接近桌面端（支持在文件管理器定位、系统默认应用或 VS Code 打开任意已登记项目文件，可通过 `WCODE_ALLOW_HOST_REVEAL=0` 关闭）；部署在远端服务器时自动隐藏只在宿主机生效的操作，避免无效点击。
- **动态工作流（DWF）开箱即用**：脱离上游配置服务运行时，Web/Server Host 默认采用 `onDemand` 策略——普通会话保持轻量，需要时即可通过 `/workflow` 或侧栏「自动化 › 工作流」运行 `.dwf.ts`；详见 [WCode 动态工作流：定义、能力边界与运行接入规范](docs/dynamic-workflow/wcode-definition-and-boundaries.md)（含 4 张架构图解）。
- **面向自托管的零配置安全默认值**：`wcode --web` 默认绑定 `127.0.0.1` 免鉴权；一旦监听 `0.0.0.0` 等非回环地址且未指定固定令牌，会自动启用一次性令牌换取 `HttpOnly` Cookie，既开箱安全又免去每次手动拼接 Token。

---

## 快速开始

### 环境准备

准备 Git、Node.js **24.14.0** 和 pnpm **10.33.2**（版本以 [mise.toml](mise.toml) 为准）。以下所有命令均在仓库根目录执行。

```bash
pnpm bootstrap
```

`pnpm bootstrap` 会安装 workspace 依赖并执行 `build:bootstrap`。Agent CLI 与运行时位于普通目录 [apps/wcode-cli/](apps/wcode-cli/)，无需额外拉取 Git submodule。如需准备远程运行资源，可执行 `pnpm bootstrap:with-remote` 或 `pnpm prepare:remote-assets`。

### 方式一：源码开发模式（Web + Server）

```bash
pnpm dev:web

# 指定后端工作区
WCODE_SERVER_WORKSPACE=/path/to/project pnpm dev:web
```

- Web 前端默认运行在 `http://localhost:5183`，后端服务默认运行在 `http://localhost:3030`，浏览器直接访问前者即可。
- 修改 [apps/wcode-cli/](apps/wcode-cli/) 源码后，运行 `pnpm --filter @wcode/cli... build` 并重启服务。
- 单独开发 CLI / TUI 时运行 `pnpm --filter @wcode/cli dev`。

### 方式二：统一命令行运行（`wcode` / `wcode --web`）

使用打包后的统一入口 `wcode`（构建方式见下方「打包与本地验证」），无需 Electron：

```bash
# 默认启动终端 TUI
wcode

# 本机启动 Web 工作台（默认监听 127.0.0.1，自动选空闲端口并打开浏览器）
wcode --web

# 局域网 / 服务器部署（非回环地址默认生成一次性访问令牌并打印带 ?token= 的首登链接）
wcode --web --host 0.0.0.0 --port 3030 --workspace /path/to/project --no-open

# 使用固定令牌（或通过环境变量 WCODE_SERVER_AUTH_TOKEN 指定）
wcode --web --host 0.0.0.0 --port 3030 --token <your-token> --no-open

# 查看全部参数
wcode --help
wcode --web --help
```

> 公网部署建议在外层配合反向代理与 HTTPS；反代终止 TLS 时，会话 Cookie 会自动附带 `Secure` 标记。

### 模型配置（首次发消息前必读）

本仓库不内置任何模型凭据，两种方式二选一：

1. **账号登录**：在 Web 界面右上角「连接使用」登录，或在 CLI 执行：
   ```bash
   pnpm --filter @wcode/cli exec tsx src/main.ts login
   ```
2. **自定义模型服务**（兼容 `openai-chat-completions`、`openai-responses`、`anthropic-messages`）：
   按 [CLI 配置文档](apps/wcode-cli/docs/usage/03-config.md#个人模型配置示例) 创建 `schemaVersion: 1` JSON 文件（如 `~/.wcode/model-config.json`），启动时传入：
   ```bash
   WCODE_BUILTIN_PROVIDER_CONFIG_FILE=/绝对路径/model-config.json pnpm dev:web
   ```
   > 个人配置文件含明文 API Key，请注意文件权限，不要提交到 Git。

本地数据默认存储在 `~/.wcode/v2/`，与旧版 ZCode 的 `~/.zcode` **完全隔离且不自动迁移**。

---

## 打包与本地验证

通过 `pnpm build:wcode` 一键构建并组装统一发行包（自动构建 CLI/TUI、Server 与 Web，剔除 `.map`，校验内置 `bundled-skills`，并在产物根目录写入合规四件套）：

```bash
# 首次打包需通过 --base-url 或环境变量 WCODE_DIST_BASE_URL 指定托管根地址
pnpm build:wcode --base-url https://downloads.example.com/wcode/

# 已配置 WCODE_DIST_BASE_URL 时直接运行
pnpm build:wcode

# 复用现有构建产物仅重新组包
pnpm build:wcode --skip-build
```

产物输出在 `dist/wcode/`（包含 `releases/<version>/wcode-<version>.tar.gz`、`sha256.txt`、`latest.json`、`install.sh`）。本地可直接解压验证完整链路：

```bash
wcode_version=$(node -p "require('./dist/wcode/latest.json').version")
mkdir -p dist/wcode/debug
tar -xzf "dist/wcode/releases/$wcode_version/wcode-$wcode_version.tar.gz" -C dist/wcode/debug

# 验证 TUI
node dist/wcode/debug/wcode/bin/wcode.mjs

# 验证独立 Web 服务（浏览器打开 http://127.0.0.1:3030）
node dist/wcode/debug/wcode/bin/wcode.mjs --web --workspace "$PWD" --port 3030 --no-open
```

---

## 常用环境变量

完整示例见根目录 [.env.example](.env.example)，内置默认配置说明见 [config/README.md](config/README.md)。

| 环境变量                             | 说明                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| `WCODE_DATA_BASE_DIR`                | 应用数据基目录，数据写入其下的 `.wcode/`              |
| `WCODE_SERVER_WORKSPACE`             | Web 后端默认工作区路径                                |
| `WCODE_SERVER_AUTH_TOKEN`            | 独立 Server 固定访问令牌（兼容 `WCODE_SERVER_TOKEN`） |
| `WCODE_DEPLOYMENT_MODE`              | 显式覆盖部署模式（`local` 或 `server`）               |
| `WCODE_ALLOW_HOST_REVEAL`            | 设为 `0` 时关闭同机宿主机文件定位 / 打开能力          |
| `WCODE_DYNAMIC_WORKFLOW_MODE`        | 覆盖动态工作流提供模式（缺省离线回退为 `onDemand`）   |
| `WCODE_BUILTIN_PROVIDER_CONFIG_FILE` | 自定义本地 Provider 配置文件绝对路径                  |
| `WCODE_DIST_BASE_URL`                | `pnpm build:wcode` 生成安装脚本时使用的下载根地址     |

---

## 仓库结构与延伸文档

| 目录                                                 | 职责                                                 |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `packages/web`                                       | 浏览器 Web 客户端                                    |
| `packages/server`                                    | HTTP / WebSocket 独立服务端与远程连接                |
| `packages/wcode-server-cli`                          | 独立 Server 启动与进程管理                           |
| `packages/ui`                                        | 共享 React 组件、hooks 与 Zustand 状态               |
| `packages/services`                                  | 业务服务、宿主机能力与持久化                         |
| `packages/shared`、`packages/rpc`、`packages/client` | 共享协议与类型、RPC 框架、Agent 客户端 SDK           |
| `packages/provider`、`packages/provider-node`        | Provider 公共能力与 Node 实现                        |
| `apps/wcode-cli`                                     | Agent CLI、TUI、运行时、工具与内置技能               |
| `docs`、`scripts`、`config`、`third-party`           | 架构与工作流文档、构建校验脚本、默认配置与第三方声明 |

延伸阅读：

- [CHANGES.md](CHANGES.md) — WCode 相对上游 ZCode 的完整修改记录与升级说明
- [动态工作流（DWF）定义、能力边界与接入规范](docs/dynamic-workflow/wcode-definition-and-boundaries.md) — 含 4 张可视化架构图
- [WCode CLI 使用指南](apps/wcode-cli/docs/usage/README.md) — TUI、非交互模式、模型配置、工具、权限与自动化评测
- [UI Plugin 指南](UI_PLUGIN.md) — UI 插件能力、API 与调试方式
- [第三方声明维护说明](third-party/README.md) — 第三方许可生成与发行校验流程

---

## 许可证与上游声明

本项目基于 [zai-org/ZCode](https://github.com/zai-org/ZCode)（`v3.18.2`，基线提交 `fec97590`）修改并沿用 **Apache License 2.0**（见 [LICENSE](LICENSE)）。

分发源码、发行包或镜像时，请一并保留以下合规文件（`pnpm build:wcode` 已自动打包至发行包根目录）：

- [LICENSE](LICENSE) — Apache-2.0 许可证原文（含上游版权行）
- [NOTICE.md](NOTICE.md) — 来源与商标声明、执行与数据风险说明
- [CHANGES.md](CHANGES.md) — 相对上游的修改说明（履行 Apache-2.0 §4(b) 义务）
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) — 第三方依赖与素材许可原文

WCode 是独立维护的社区分支，**并非 Z.ai 官方项目**，未获得其背书或赞助；"ZCode"、"Z.ai" 等名称与标识归其各自权利人所有。
