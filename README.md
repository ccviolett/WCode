# WCode

<div align="center">
  <img src="public/logo/icons/1024x1024.png" alt="WCode" width="120" height="120" />
</div>

<p align="center">
  简体中文 | <a href="README.en.md">English</a>
</p>

<p align="center">
  基于 <a href="https://github.com/zai-org/ZCode">zai-org/ZCode</a>（<code>v4.0.0</code>）派生的纯 Web、独立 Server 与 Agent CLI/TUI 轻量化分支
</p>

---

WCode 面向 **本地浏览器、局域网与云服务器自托管** 场景，在保留完整 Web 工作台与 Agent CLI/TUI 能力的前提下，彻底移除 Electron 桌面端耦合，并围绕 Web 独立运行、安全访问控制、动态工作流开箱体验与轻量分发进行了系统化改造。

> **关于上游原项目**：ZCode 的原生 AI 编程能力、Agent 运行时理念与通用功能说明，请直接查阅上游仓库 [zai-org/ZCode](https://github.com/zai-org/ZCode)。本文档聚焦 **WCode 相对 ZCode 的核心优化** 与 **本仓库的实际使用方式**。

## 相对 ZCode 的核心优化

| 维度                           | 上游 ZCode                                                                          | WCode 优化                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **运行形态与体积**             | 包含 Electron 桌面端、`packages/desktop`、`/remote` 桌面远控及大量桌面构建/E2E 依赖 | **纯 Web + 独立 HTTP/WS Server + Agent CLI/TUI**；彻底移除桌面端、`/remote` 远控及 Electron/WDIO/`@arms/rum-electron` 等依赖，`window-controller` 降为可选能力                                                                                                                                                   |
| **Web 独立运行与宿主机能力**   | Web 侧文件定位/打开能力依赖桌面宿主或各入口分散判断；默认固定暗色主题               | 服务端自动判定 `deployment.mode`（`local` / `server`）；同机图形宿主开放 `realpath` 白名单保护（覆盖全部已登记项目根）的 Finder/资源管理器定位、默认应用与 VS Code 打开，远端访问自动隐藏本机专属入口；默认主题跟随系统外观；Web 开发默认端口 `5183`                                                             |
| **服务端安全鉴权**             | 非回环访问需手动管理长期令牌，URL 携带令牌易留存在浏览器历史与 Referer              | 监听非回环地址且未配固定令牌时自动生成**一次性访问令牌**，首次打开写入 `HttpOnly` 会话 Cookie（TLS 反代下自动追加 `Secure`）并 `302` 清除 URL 中的 token；兼容 `Authorization: Bearer` 与 `WCODE_SERVER_AUTH_TOKEN`                                                                                              |
| **Web 端动态工作流（DWF）**    | 离线/无远端下发时默认关闭或依赖远端开关；产物打开偏桌面 `file://` 路径              | 离线/无远端下发时缺省模式改为 `onDemand`（默认保留 `/workflow` 与「自动化 › 工作流」入口，且不污染普通对话工具集）；HTML 产物本机可直开系统浏览器、远端平滑回退文件树定位；发行包内置 `bundled-skills`；附带中文全景定义与边界图解指南                                                                           |
| **统一轻量发行包与零源码部署** | 桌面安装包与 CLI 分离，产物携带全部 `.map` 调试文件                                 | `pnpm build:wcode` 产出统一 `wcode` 单入口（`wcode` 启动 TUI，`wcode --web` 启动 Web），自动剔除全部 `.map`、内置 `agent/packages/bundled-skills` 与合规四件套；提供 **GitHub Releases 一键安装（自带 Node 24 私有兜底 + SHA-256 校验）**、`systemd` + Nginx/Caddy 模板与多架构 **Docker / GHCR** 容器镜像       |
| **品牌隔离与外部契约保护**     | 共享 `@zcode/*`、`~/.zcode` 与 `ZCODE_*` 命名空间                                   | 内部包作用域（`@wcode/*`）、CLI（`wcode`）、环境变量（`WCODE_*`）、数据目录（`~/.wcode/v2/`）与 W 字形 Logo 彻底隔离；**同时严格保留上游外部服务契约**（`zcode.z.ai`、`/api/v1/zcode-plan/*`、`cdn-zcode.z.ai/zcode/official-plugin/*`、`/zcode/deps`、`zcode-cua`），确保官方账号登录、套餐校验与插件市场无 404 |

完整变更明细与升级注意事项见 [CHANGES.md](CHANGES.md)。

### 几项关键改进说明

- **本机与远端自动分层**：服务端根据代理转发头与对端回环地址自动判定 `deployment.mode`（可用 `WCODE_DEPLOYMENT_MODE` 显式覆盖）。本机通过浏览器使用时体验接近桌面端（支持在文件管理器定位、系统默认应用或 VS Code 打开任意已登记项目文件，可通过 `WCODE_ALLOW_HOST_REVEAL=0` 关闭）；部署在远端服务器时自动隐藏只在宿主机生效的操作，避免无效点击。
- **动态工作流（DWF）开箱即用**：脱离上游配置服务运行时，Web/Server Host 默认采用 `onDemand` 策略——普通会话保持轻量，需要时即可通过 `/workflow` 或侧栏「自动化 › 工作流」运行 `.dwf.ts`；详见 [WCode 动态工作流：定义、能力边界与运行接入规范](docs/dynamic-workflow/wcode-definition-and-boundaries.md)（含 4 张架构图解）。
- **面向自托管的零配置安全默认值**：`wcode --web` 默认绑定 `127.0.0.1` 免鉴权；一旦监听 `0.0.0.0` 等非回环地址且未指定固定令牌，会自动启用一次性令牌换取 `HttpOnly` Cookie，既开箱安全又免去每次手动拼接 Token。

---

## 零源码部署与选型指南（无需 clone 代码）

WCode 提供 **3 种开箱部署方式**，请先按使用场景选择（详细配置见 [deploy/README.md](deploy/README.md)）：

| 部署方式                                 | 推荐场景                                      | 本地目录访问与宿主机能力                                                                                                                       |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **方式一：本机一键安装（推荐个人主力）** | macOS / Linux 本机日常编程（TUI + 本机 Web）  | **完整访问电脑任意本地目录**；保留本机工具链、Git/SSH 凭据与 Finder / VS Code 打开能力；无 Node 24 时自动下载隔离私有运行时（不污染系统 Node） |
| **方式二：Linux `systemd` + 反代常驻**   | 自有 Linux VPS、物理开发机、团队主机长期托管  | **完整访问服务器本地目录**与服务器工具链；配合 Nginx / Caddy 提供 HTTPS 与 WebSocket 代理                                                      |
| **方式三：Docker / `docker compose`**    | **容器化云主机、NAS、团队快速试用、隔离沙箱** | **仅能访问显式挂载到 `/workspace` 的目录**，无法访问宿主机其他未挂载本地目录，且无宿主机 Finder / VS Code 图形能力                             |

> [!WARNING]
> **关于 Docker 部署的适用边界**：Docker 容器与宿主机文件系统及开发环境隔离，**存在无法自由访问和编辑宿主机本地目录的情况**。
> 如果你是为了在自己电脑上编辑本地项目，请优先使用 **方式一（本机一键安装）**；**Docker 建议仅用于容器化/云端隔离服务部署**（项目代码放在挂载卷 `/workspace` 内维护，或通过远程 SSH 工作区连接其他开发机）。

### 方式一：本机一键安装（macOS / Linux）

```bash
curl -fsSL https://github.com/ccviolett/WCode/releases/latest/download/install.sh | sh

# 启动终端 TUI
wcode

# 启动本机 Web 工作台（默认监听 127.0.0.1 并打开浏览器，可读写本机任意目录）
wcode --web
```

> 首次发布需推送 `v*` tag 或在 GitHub Actions 手动运行 `Release WCode` 生成 Release 资产；自定义镜像源或历史版本可通过 `WCODE_DIST_BASE_URL`、`WCODE_NODE_DIST_URL` 覆盖，详见 [deploy/README.md](deploy/README.md)。

### 方式二：Linux 服务器常驻部署（`systemd` + HTTPS 反代）

```bash
# 1. 安装统一运行包到系统目录（无 Node 24 时同样自动下载私有 Node 运行时）
curl -fsSL https://github.com/ccviolett/WCode/releases/latest/download/install.sh \
  | sudo WCODE_DIST_HOME=/opt/wcode WCODE_DIST_BIN_DIR=/usr/local/bin sh

# 2. 复制并配置环境变量（设置 WCODE_SERVER_AUTH_TOKEN 与 WCODE_SERVER_WORKSPACE）
sudo install -d -m 755 /etc/wcode /var/lib/wcode /srv/workspace
sudo cp deploy/systemd/wcode.env.example /etc/wcode/wcode.env
sudo chmod 600 /etc/wcode/wcode.env

# 3. 启用 systemd 服务（按实际运行用户调整 User=）
sudo cp deploy/systemd/wcode.service /etc/systemd/system/wcode.service
sudo systemctl daemon-reload && sudo systemctl enable --now wcode
```

公网暴露请配合外层 HTTPS 反向代理（参考 [deploy/nginx/wcode.conf](deploy/nginx/wcode.conf) 或 [deploy/caddy/Caddyfile](deploy/caddy/Caddyfile)）。

### 方式三：Docker / `docker compose`（建议仅用于容器/云端部署）

使用仓库根目录的 [docker-compose.yml](docker-compose.yml)（拉取 `ghcr.io/ccviolett/wcode:latest` 多架构镜像）：

```bash
mkdir -p workspace
export WCODE_SERVER_AUTH_TOKEN="$(openssl rand -hex 24)"
docker compose up -d
```

- 持久化数据卷挂在 `/data`（保存登录态、会话与配置），容器工作区挂在 `/workspace`（容器内 Agent 仅能访问该挂载目录）。
- 未设置 `WCODE_SERVER_AUTH_TOKEN` 时，首次启动会在 `docker logs wcode` 打印一次性 `?token=` 首登链接；访问一次后自动写入 `HttpOnly` 会话 Cookie。

### 模型配置（首次发消息前必读）

本仓库不内置任何模型凭据，以上任意部署方式均支持以下二选一：

1. **账号登录**：在 Web 界面右上角「连接使用」登录，或在 CLI 执行 `wcode login`（源码开发模式为 `pnpm --filter @wcode/cli exec tsx src/main.ts login`）。
2. **自定义模型服务**（兼容 `openai-chat-completions`、`openai-responses`、`anthropic-messages`）：
   按 [CLI 配置文档](apps/wcode-cli/docs/usage/03-config.md#个人模型配置示例) 创建 `schemaVersion: 1` JSON 文件（如 `~/.wcode/model-config.json`），通过 `WCODE_BUILTIN_PROVIDER_CONFIG_FILE=/绝对路径/model-config.json` 传入（Docker 场景以只读卷挂载进容器）。
   > 个人配置文件含明文 API Key，请注意文件权限，不要提交到 Git。

本地数据默认存储在 `~/.wcode/v2/`，与旧版 ZCode 的 `~/.zcode` **完全隔离且不自动迁移**。

---

## 从源码开发与打包

### 环境准备

准备 Git、Node.js **24.14.0** 和 pnpm **10.33.2**（版本以 [mise.toml](mise.toml) 为准）。以下所有命令均在仓库根目录执行。

```bash
pnpm bootstrap
```

`pnpm bootstrap` 会安装 workspace 依赖并执行 `build:bootstrap`。Agent CLI 与运行时位于普通目录 [apps/wcode-cli/](apps/wcode-cli/)，无需额外拉取 Git submodule。如需准备远程运行资源，可执行 `pnpm bootstrap:with-remote` 或 `pnpm prepare:remote-assets`。

### 本地开发模式（Web + Server）

```bash
pnpm dev:web

# 指定后端工作区
WCODE_SERVER_WORKSPACE=/path/to/project pnpm dev:web
```

- Web 前端默认运行在 `http://localhost:5183`，后端服务默认运行在 `http://localhost:3030`，浏览器直接访问前者即可。
- 修改 [apps/wcode-cli/](apps/wcode-cli/) 源码后，运行 `pnpm --filter @wcode/cli... build` 并重启服务。
- 单独开发 CLI / TUI 时运行 `pnpm --filter @wcode/cli dev`。

### 打包与本地验证

通过 `pnpm build:wcode` 一键构建并组装统一发行包（自动构建 CLI/TUI、Server 与 Web，剔除 `.map`，校验内置 `bundled-skills`，并在产物根目录写入合规四件套）：

```bash
# 静态托管目录结构（默认 --layout nested）
pnpm build:wcode --base-url https://downloads.example.com/wcode/

# GitHub Releases 扁平资产结构（--flat）
pnpm build:wcode --flat --base-url https://github.com/ccviolett/WCode/releases/latest/download/

# 复用现有构建产物仅重新组包
pnpm build:wcode --skip-build
```

产物输出在 `dist/wcode/`（包含运行包 `.tar.gz`、`sha256.txt`、`latest.json`、`install.sh`）。本地可直接解压验证完整链路：

```bash
wcode_tarball=$(node -p "const m=require('./dist/wcode/latest.json'); m.tarballPath || ('releases/' + m.version + '/' + m.tarball)")
mkdir -p dist/wcode/debug
tar -xzf "dist/wcode/$wcode_tarball" -C dist/wcode/debug

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

- [部署与运维指南](deploy/README.md) — 三种零源码部署方式详解、`systemd` / Nginx / Caddy 配置与 Docker 适用边界
- [CHANGES.md](CHANGES.md) — WCode 相对上游 ZCode 的完整修改记录与升级说明
- [动态工作流（DWF）定义、能力边界与接入规范](docs/dynamic-workflow/wcode-definition-and-boundaries.md) — 含 4 张可视化架构图
- [WCode CLI 使用指南](apps/wcode-cli/docs/usage/README.md) — TUI、非交互模式、模型配置、工具、权限与自动化评测
- [UI Plugin 指南](UI_PLUGIN.md) — UI 插件能力、API 与调试方式
- [第三方声明维护说明](third-party/README.md) — 第三方许可生成与发行校验流程

---

## 许可证与上游声明

本项目基于 [zai-org/ZCode](https://github.com/zai-org/ZCode)（`v4.0.0`，基线提交 `a4b44451`）修改并沿用 **Apache License 2.0**（见 [LICENSE](LICENSE)）。

分发源码、发行包或镜像时，请一并保留以下合规文件（`pnpm build:wcode` 已自动打包至发行包根目录）：

- [LICENSE](LICENSE) — Apache-2.0 许可证原文（含上游版权行）
- [NOTICE.md](NOTICE.md) — 来源与商标声明、执行与数据风险说明
- [CHANGES.md](CHANGES.md) — 相对上游的修改说明（履行 Apache-2.0 §4(b) 义务）
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) — 第三方依赖与素材许可原文

WCode 是独立维护的社区分支，**并非 Z.ai 官方项目**，未获得其背书或赞助；"ZCode"、"Z.ai" 等名称与标识归其各自权利人所有。
