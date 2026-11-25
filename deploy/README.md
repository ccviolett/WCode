# WCode 零源码部署指南

WCode 提供 **3 种零源码部署方式**（无需 `git clone`，无需安装 `pnpm` 或编译项目）。不同方式对**本地目录访问权限、开发环境工具链与隔离性**的取舍不同，请先按使用场景选型。

---

## 一、部署方式选型与适用性对比

| 部署方式                                  | 推荐场景                                              | 宿主机本地目录访问                                                           | 本机 GUI（Finder / VS Code） | 依赖前置                                                          |
| ----------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| **1. 一键本机安装（GitHub Releases）**    | 个人 macOS / Linux 电脑日常编程（TUI + 本机 Web）     | **完整访问任意本机目录**，路径 100% 一致，复用本机 SDK 与 Git/SSH 凭据       | **完整支持**                 | 仅需 `curl` + `tar`（无 Node 24 时自动私下安装，不污染系统 Node） |
| **2. Linux 服务器 `systemd` 常驻部署**    | 自有 Linux VPS、物理开发机或团队主机长期提供 Web 服务 | **完整访问服务器本地目录**与服务器已有工具链                                 | 自动关闭（服务端远端模式）   | 仅需 `curl` + `tar` + `systemd`（建议配 Nginx / Caddy HTTPS）     |
| **3. Docker / `docker compose` 容器部署** | **容器化云主机、NAS、团队快速试用、隔离沙箱**         | **受限：仅能访问显式挂载到 `/workspace` 的目录**，无法访问宿主机其他本地目录 | 不支持（无图形宿主）         | Docker Engine / Compose                                           |

> [!WARNING]
> **关于 Docker 部署的重要说明**：Docker 容器与宿主机文件系统及开发工具链天然隔离，**无法自由打开和编辑宿主机上未挂载的本地目录**，也不会具备 Finder / VS Code / 本机默认浏览器打开能力。
> 如果你的目标是**在自己电脑上编辑本地项目代码**，请务必选择 **方式一（一键本机安装）**；**Docker 仅推荐用于容器/云端隔离服务部署**（在挂载卷 `/workspace` 内 `git clone` 项目，或通过 WCode 远程 SSH 工作区连接其他开发机）。

---

## 二、方式一：本机一键安装（macOS / Linux，个人开发首选）

```bash
curl -fsSL https://github.com/ccviolett/WCode/releases/latest/download/install.sh | sh
```

安装脚本会自动完成以下工作：

1. 检查系统 `node` 版本；若已安装 Node.js `>= 24` 直接复用，否则自动在 `~/.wcode/runtime/node/` 下载一份**独立隔离的 Node.js 24.14.0**（不改动你的系统 Node / `nvm` / `mise` 配置）。
2. 从 GitHub Releases 拉取最新版 `wcode-<version>.tar.gz`，强制校验 SHA-256 摘要后解压到 `~/.wcode/runtime/current`。
3. 在 `~/.local/bin/wcode` 创建统一命令入口。

安装完成后即可在电脑上**任意项目目录**直接运行：

```bash
# 终端 TUI
wcode

# 本机 Web 工作台（默认监听 127.0.0.1 并打开浏览器，可读写本机任意目录）
wcode --web

# 指定初始项目目录
wcode --web --workspace /path/to/your/project
```

常用安装变量覆盖（按需在 `sh` 前设置）：

| 变量                       | 说明                                    | 默认值                    |
| -------------------------- | --------------------------------------- | ------------------------- |
| `WCODE_DIST_HOME`          | 运行时安装目录                          | `$HOME/.wcode/runtime`    |
| `WCODE_DIST_BIN_DIR`       | `wcode` 命令目录                        | `$HOME/.local/bin`        |
| `WCODE_DIST_BASE_URL`      | 自定义下载源或指定历史版本 Release URL  | 最新 GitHub Release       |
| `WCODE_NODE_DIST_URL`      | 私有 Node.js 镜像源（国内网络可换镜像） | `https://nodejs.org/dist` |
| `WCODE_DIST_NODE_FALLBACK` | 设为 `0` 时禁用自动下载私有 Node 24     | `1`                       |

---

## 三、方式二：Linux 服务器常驻服务（`systemd` + HTTPS 反向代理）

适合希望直接把 WCode 跑在 Linux VPS / 开发机宿主机上、随时编辑服务器上项目并保留服务器全套工具链的场景。

### 1. 安装运行包到系统目录

```bash
curl -fsSL https://github.com/ccviolett/WCode/releases/latest/download/install.sh \
  | sudo WCODE_DIST_HOME=/opt/wcode WCODE_DIST_BIN_DIR=/usr/local/bin sh
```

### 2. 准备目录与环境文件

参考 [deploy/systemd/wcode.env.example](systemd/wcode.env.example)：

```bash
sudo install -d -m 755 /etc/wcode /var/lib/wcode /srv/workspace
sudo install -d -m 700 /var/lib/wcode/.wcode/v2
# 无桌面 Linux 服务器没有 DBus Secret Service 时，为凭据加密库生成 0600 权限的 32 字节密钥文件（勿丢失）
sudo sh -c 'umask 077 && openssl rand -out /var/lib/wcode/.wcode/v2/credential-secret 32'
sudo chown -R wcode:wcode /var/lib/wcode
sudo cp deploy/systemd/wcode.env.example /etc/wcode/wcode.env
sudo chmod 600 /etc/wcode/wcode.env
# 编辑 /etc/wcode/wcode.env：
# - 填入强随机 WCODE_SERVER_AUTH_TOKEN（可用 `openssl rand -hex 24` 生成）
# - 按实际开发目录修改 WCODE_SERVER_WORKSPACE
```

### 3. 安装并启动 `systemd` 服务

参考 [deploy/systemd/wcode.service](systemd/wcode.service)（请按实际运行用户调整 `User=` 与目录属主）：

```bash
sudo cp deploy/systemd/wcode.service /etc/systemd/system/wcode.service
sudo systemctl daemon-reload
sudo systemctl enable --now wcode
sudo systemctl status wcode
```

查看日志（未设固定令牌且监听非回环地址时，一次性首登链接会打印在这里）：

```bash
journalctl -u wcode -f
```

### 4. 配置 HTTPS 反向代理

公网暴露务必套 HTTPS 反向代理，并透传 WebSocket（`/ws`）与 `X-Forwarded-Proto`：

- Nginx 参考配置：[deploy/nginx/wcode.conf](nginx/wcode.conf)
- Caddy 自动 HTTPS 参考配置：[deploy/caddy/Caddyfile](caddy/Caddyfile)

---

## 四、方式三：Docker / `docker compose`（仅推荐容器/云端隔离部署）

> 再次提示：容器模式**只能编辑挂载到 `/workspace` 的目录**，不支持访问宿主机其他未挂载目录或调用宿主机桌面软件。

### 使用预构建镜像快速启动（推荐）

下载仓库根目录的 [docker-compose.yml](../docker-compose.yml)，按需配置环境变量后启动：

```bash
mkdir -p workspace
export WCODE_SERVER_AUTH_TOKEN="$(openssl rand -hex 24)"
docker compose up -d
```

或者直接用 `docker run`：

```bash
docker run -d --name wcode --restart unless-stopped \
  -p 3030:3030 \
  -e WCODE_SERVER_AUTH_TOKEN="your-strong-token" \
  -v wcode_data:/data \
  -v "$PWD/workspace:/workspace" \
  ghcr.io/ccviolett/wcode:latest
```

首次访问说明：

- 若设置了 `WCODE_SERVER_AUTH_TOKEN`，浏览器首次打开 `http://<服务器IP>:3030/?token=<你的令牌>`，服务端会自动写入 `HttpOnly` 会话 Cookie 并 `302` 去掉 URL 中的 `token`，后续访问不再需要重复带参数。
- 若未设置 `WCODE_SERVER_AUTH_TOKEN`，启动后执行 `docker logs wcode` 获取本次生成的一次性首登链接。
- 如使用自定义 OpenAI / Anthropic 兼容 API（不登录官方账号），将个人 `model-config.json` 以只读方式挂载进容器，并设置 `WCODE_BUILTIN_PROVIDER_CONFIG_FILE=/config/model-config.json`。

### 从源码本地构建镜像

```bash
docker build -t wcode:local .
```

镜像内部已预装 `node 24.14.0`、`git`、`ripgrep`、`curl`、`python3`、`openssh-client`、`ca-certificates`、`tini`，默认以非 root 用户 `node` 运行并内置 `HEALTHCHECK`。
