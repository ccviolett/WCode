# syntax=docker/dockerfile:1.7

# ==============================================================================
# WCode 容器镜像（多阶段构建）
#
# 适用范围提示：
#   Docker 容器仅能访问显式挂载到 /workspace 的目录，无法直接读写宿主机未挂载的
#   任意本地目录，也不具备宿主机 Finder / VS Code 等桌面交互能力。
#   - 云服务器 / NAS / 容器化隔离部署：推荐本镜像 + docker-compose.yml
#   - 本机开发（编辑分散在电脑各处的本地目录）：请改用 GitHub Releases 一键脚本直装
# ==============================================================================

FROM --platform=$BUILDPLATFORM node:24.14.0-bookworm-slim AS builder

ENV HUSKY=0 \
    CI=true \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

WORKDIR /src

# Bug 原因：Linux 下 pnpm install 会通过 node-gyp 源码编译 node-pty / cpu-features，
# bookworm-slim 默认缺少 python3/make/g++；同时用 npm 直接安装固定版本 pnpm，避免 corepack 签名过期问题。
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      git \
      python3 && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@10.33.2

COPY . .

ARG WCODE_DIST_BASE_URL="https://github.com/ccviolett/WCode/releases/latest/download/"

RUN --mount=type=cache,id=wcode-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile && \
    pnpm run build:bootstrap && \
    pnpm run build:wcode -- --flat --base-url "${WCODE_DIST_BASE_URL}" && \
    mkdir -p /opt && \
    tar -xzf dist/wcode/wcode-*.tar.gz -C /opt

FROM node:24.14.0-bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      git \
      openssh-client \
      python3 \
      ripgrep \
      tini && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /opt/wcode /opt/wcode
COPY deploy/docker/entrypoint.sh /usr/local/bin/wcode-docker-entrypoint.sh

RUN ln -sfn /opt/wcode/bin/wcode.mjs /usr/local/bin/wcode && \
    chmod +x /usr/local/bin/wcode-docker-entrypoint.sh && \
    mkdir -p /data /workspace && \
    chown -R node:node /data /workspace

ENV NODE_ENV=production \
    PORT=3030 \
    WCODE_SERVER_HOST=0.0.0.0 \
    WCODE_SERVER_WORKSPACE=/workspace \
    WCODE_DATA_BASE_DIR=/data \
    WCODE_DEPLOYMENT_MODE=server \
    WCODE_ALLOW_HOST_REVEAL=0

USER node
WORKDIR /workspace

VOLUME ["/data", "/workspace"]
EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3030}/" >/dev/null || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["/usr/local/bin/wcode-docker-entrypoint.sh"]
