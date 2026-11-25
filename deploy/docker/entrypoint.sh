#!/bin/sh
set -eu

# Bug 原因：v4.0.0 服务端启动强制初始化加密凭据库；无桌面 Docker 容器没有 OS Keychain / DBus Secret Service，
# 首次启动会因缺密钥报 CREDENTIAL_SECURE_STORAGE_UNAVAILABLE。在持久化目录未绑定来源且无旧凭据时，
# 排他创建 0600 的 32 字节随机 credential-secret，重启复用同一密钥且绝不覆盖已有文件。
if [ -z "${WCODE_CREDENTIAL_SECRET:-}" ] && [ -z "${WCODE_CREDENTIAL_SECRET_FILE:-}" ]; then
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const crypto = require("node:crypto");
    const base = (process.env.WCODE_DATA_BASE_DIR || "/data").trim() || "/data";
    const dir = path.join(base, ".wcode", "v2");
    const secretFile = path.join(dir, "credential-secret");
    const sourceFile = path.join(dir, "credential-source");
    const credFile = path.join(dir, "credentials.json");
    if (!fs.existsSync(secretFile) && !fs.existsSync(sourceFile) && !fs.existsSync(credFile)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      try {
        fs.writeFileSync(secretFile, crypto.randomBytes(32), { flag: "wx", mode: 0o600 });
      } catch (error) {
        if (!error || error.code !== "EEXIST") throw error;
      }
    }
  '
fi

exec node "${WCODE_RUNNER_BIN:-/opt/wcode/bin/wcode.mjs}" --web \
  --host "${WCODE_SERVER_HOST:-0.0.0.0}" \
  --port "${PORT:-3030}" \
  --workspace "${WCODE_SERVER_WORKSPACE:-/workspace}" \
  --no-open "$@"
