# WCode 零源码分发与三种部署方式规格说明

本文档定义 WCode 面向终端用户与运维人员的**三种零源码部署方式**、各自的适用边界、安装与运行时接口契约以及验收标准。

---

## 一、产品目标与部署模式适用性边界

让用户无需 `git clone` 源码、无需安装 `pnpm` 或编译 monorepo，即可按自身场景选用最合适的运行形态，并**明确区分宿主机直装与容器隔离的边界**，避免误用 Docker 编辑宿主机任意本地目录。

| 部署方式                                            | 核心产物                                                                    | 适用场景                                                                                         | 宿主机任意本地目录与 GUI 能力                                                                                                  | 不建议使用的场景                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **1. 一键本机/宿主机安装**                          | GitHub Releases (`wcode-<version>.tar.gz` + `install.sh`)                   | 个人 macOS / Linux 本机日常编程、终端 TUI + 本机 Web 工作台                                      | **完整支持**：可直接打开和编辑本机任意目录，保留本机工具链、Git/SSH 凭据以及 Finder/VS Code/默认浏览器打开能力                 | 需要强进程/文件系统隔离的公网多租户环境                    |
| **2. Linux 服务器常驻部署（`systemd` + 反向代理）** | 方式 1 运行包 + `deploy/systemd/*` + `deploy/nginx/*` / `deploy/caddy/*`    | 自有 Linux VPS、物理开发机、团队共享主机长期托管 Web 服务                                        | **完整支持服务器本地目录**：可直接操作服务器上所有已授权项目目录与原生 SDK；远端访问自动隐藏宿主机 GUI 入口                    | 无 `systemd` 的精简容器/NAS 环境                           |
| **3. Docker / `docker compose` 容器部署**           | GHCR 镜像 (`ghcr.io/ccviolett/wcode`) + `Dockerfile` + `docker-compose.yml` | **容器化云主机、NAS、团队快速试用、隔离沙箱**（代码在挂载卷内维护或通过远程 SSH 连接其他开发机） | **不支持访问未挂载的宿主机本地目录**；容器内为 headless Linux，无 Finder/VS Code 等宿主机 GUI 能力，且容器内工具链与宿主机隔离 | **不建议**在本机用来日常编辑分散在宿主机各处的本地项目目录 |

---

## 二、状态所有者与运行时接口契约

### 2.1 统一运行包构建（`scripts/build-wcode.mjs`）

- 新增 `--layout <nested|flat>`（以及简写 `--flat`）：
  - `nested`（默认，向后兼容既有静态托管）：产物写入 `dist/wcode/releases/<version>/wcode-<version>.tar.gz` 与 `sha256.txt`，`latest.json` 记录 `tarballPath: "releases/<version>/wcode-<version>.tar.gz"`。
  - `flat`（用于 GitHub Releases）：产物直接写入 `dist/wcode/wcode-<version>.tar.gz` 与 `dist/wcode/sha256.txt`（与 `latest.json`、`install.sh` 同层），`latest.json` 记录 `tarballPath: "wcode-<version>.tar.gz"`，便于直接上传为 GitHub Release 扁平资产。
- 两种布局下，`latest.json` 均保留 `baseUrl`、`createdAt`、`name`、`sha256`、`tarball`、`tarballPath`、`version` 字段。

### 2.2 一键安装脚本（`scripts/wcode-distribution/installer.mjs`）

- **唯一安装目录所有权**：运行时统一安装到 `WCODE_DIST_HOME`（默认 `$HOME/.wcode/runtime`），入口脚本写入 `WCODE_DIST_BIN_DIR`（默认 `$HOME/.local/bin/wcode`）。
- **零全局污染的 Node 24 自动兜底**：
  1. 若设置 `WCODE_NODE_BIN`，直接使用并校验主版本 `>= 24`。
  2. 否则检测 `PATH` 中的 `node`；若存在且主版本 `>= 24`，直接复用。
  3. 否则检测已安装的私有运行时 `$INSTALL_DIR/node/current/bin/node`；若主版本 `>= 24`，直接复用。
  4. 否则（除非显式设置 `WCODE_DIST_NODE_FALLBACK=0`），按 `uname -s` / `uname -m`（支持 `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`）从 `WCODE_NODE_DIST_URL`（默认 `https://nodejs.org/dist`）下载 `WCODE_NODE_VERSION`（默认 `24.14.0`）至 `$INSTALL_DIR/node/v<ver>` 并更新 `$INSTALL_DIR/node/current` 软链，不修改用户系统全局 Node 或 shell 配置。
- **下载路径兼容与完整性校验**：
  - 优先读取 `latest.json` 中的 `tarballPath`，缺省回退为 `releases/$VERSION/$TARBALL`（兼容旧版静态源）。
  - 若 `latest.json` 包含非空 `sha256`，使用已解析的 Node 24 内置 `node:crypto` 计算下载包 SHA-256，校验不一致时中止安装并保持现有 `current` 版本不受损。
- **启动器垫片（`$BIN_DIR/wcode`）**：
  - 优先采用 `WCODE_NODE_BIN`，其次采用 `$INSTALL_DIR/node/current/bin/node`（若存在），最后回退到 `PATH` 中的 `node`，确保在 `systemd` 或精简 `PATH` 环境下同样稳定启动。

### 2.3 统一运行入口令牌优先级（`scripts/wcode-distribution/runner.mjs`）

`wcode --web` 决定服务端鉴权令牌的唯一优先级：

1. `--no-token`：显式关闭鉴权，清空传给子进程的 `WCODE_SERVER_AUTH_TOKEN` 与 `WCODE_SERVER_TOKEN`（最高优先级）。
2. `--token <value>`：使用命令行显式令牌。
3. 环境变量 `WCODE_SERVER_AUTH_TOKEN`（兼容历史名 `WCODE_SERVER_TOKEN`）：供 `systemd` `EnvironmentFile` 与 Docker 环境变量使用，避免密钥暴露在进程命令行参数（`ps`）中，且**不在启动日志回显密钥明文**。
4. 未指定以上项且监听非回环地址（如 `0.0.0.0`）：自动生成本次启动的随机令牌并打印带 `?token=` 的首登链接（访问一次后由服务端写入 `HttpOnly` 会话 Cookie 并 `302` 清除 URL 中的 token）。
5. 未指定以上项且监听回环地址（默认 `127.0.0.1`）：不启用鉴权。

### 2.4 Linux `systemd` 与反向代理模板（`deploy/`）

- `deploy/systemd/wcode.service`：通过 `EnvironmentFile=-/etc/wcode/wcode.env` 注入工作区、数据目录和固定令牌，以 `wcode --web --host 127.0.0.1 --port 3030 --no-open` 或显式配置启动，配合反代对外提供 HTTPS。
- `deploy/nginx/wcode.conf` 与 `deploy/caddy/Caddyfile`：透传 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto` 并开启 `/ws` WebSocket 升级与长连接超时，保证服务端正确识别 `deployment.mode = server` 与 TLS `Secure` Cookie。

### 2.5 Docker / `docker compose` 容器部署（`Dockerfile`、`docker-compose.yml`）

- **多阶段构建**：builder 阶段在 `node:24.14.0-bookworm-slim` 中执行 `pnpm build:wcode --flat`，runtime 阶段仅保留解包后的 `/opt/wcode` 运行时与基础编码工具（`git`、`curl`、`ripgrep`、`python3`、`openssh-client`、`ca-certificates`、`bash`、`tini`），以非 root 用户 `node` 运行。
- **固定环境契约**：
  - `WCODE_DATA_BASE_DIR=/data`（持久化登录态、SQLite 会话与设置，数据位于 `/data/.wcode/`）。
  - `WCODE_SERVER_WORKSPACE=/workspace`（默认工作区挂载点）。
  - `WCODE_DEPLOYMENT_MODE=server`、`WCODE_ALLOW_HOST_REVEAL=0`（明确处于无宿主 GUI 的容器服务端模式）。
  - `HEALTHCHECK` 探测 `GET http://127.0.0.1:3030/`（静态首页不要求鉴权，有/无 `WCODE_SERVER_AUTH_TOKEN` 均可正常通过）。
- **明确边界说明**：在 `docker-compose.yml`、`deploy/README.md` 与根 `README.md` / `README.en.md` 中显著提醒 Docker 无法访问未挂载的宿主机本地目录，仅建议用于容器/云服务器/NAS 隔离部署。

### 2.6 自动发布流水线（`.github/workflows/release.yml`）

- 触发条件：推送 `v*` tag 或手动 `workflow_dispatch`。
- Job 1（`release-tarball`）：执行 `pnpm bootstrap`、`pnpm build:wcode --flat --base-url https://github.com/${{ github.repository }}/releases/latest/download/`、运行 `node --test scripts/wcode-distribution.test.mjs`，并将 `wcode-<version>.tar.gz`、`sha256.txt`、`latest.json`、`install.sh` 发布至 GitHub Release。
- Job 2（`docker-image`）：构建并推送多架构（`linux/amd64`、`linux/arm64`）镜像至 `ghcr.io/<owner>/wcode`（打 `:<version>` 及正式版 `:latest` 标签）。

---

## 三、验收场景

1. **回归测试（`node --test scripts/wcode-distribution.test.mjs`）**：
   - `nested` 既有布局安装流程保持 100% 通过。
   - `flat`（GitHub Releases）布局安装 + `sha256` 校验通过；篡改包内容触发 `sha256` 校验失败且不破坏已有安装。
   - 宿主无可用 Node 24（隔离 `PATH` 场景）时，`install.sh` 自动从自定义 `WCODE_NODE_DIST_URL` 下载私有 Node 运行时到 `$WCODE_DIST_HOME/node/` 并成功运行已安装的 `wcode`。
   - `runner.mjs` 在 `--host 0.0.0.0` 下正确继承 `WCODE_SERVER_AUTH_TOKEN` 且不向 stdout 打印明文密钥；显式 `--no-token` 时同时清空 `WCODE_SERVER_AUTH_TOKEN` 与 `WCODE_SERVER_TOKEN`。
2. **本地构建验证**：
   - `pnpm build:wcode --skip-build --flat --base-url https://github.com/ccviolett/WCode/releases/latest/download/` 产出完整 4 个扁平资产且校验摘要一致。
   - 若本机 Docker Daemon 可用，执行 `docker build` 验证镜像构建与容器健康启动；若 Daemon 未启动，如实记录并验证 Dockerfile/Compose 语法。
3. **工程门禁**：`pnpm typecheck`、`pnpm lint`、`pnpm run docs:stale-phrases:check`、`pnpm verify:pre-push` 全部通过。
