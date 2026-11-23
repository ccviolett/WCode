const packageDirName = "wcode";
const defaultNodeVersion = "24.14.0";

export function installScriptSource(baseUrl, options = {}) {
  const nodeVersion = options.nodeVersion ?? defaultNodeVersion;
  return `#!/usr/bin/env sh
set -eu

BASE_URL="\${WCODE_DIST_BASE_URL:-${baseUrl}}"
INSTALL_DIR="\${WCODE_DIST_HOME:-$HOME/.wcode/runtime}"
BIN_DIR="\${WCODE_DIST_BIN_DIR:-$HOME/.local/bin}"
NODE_VERSION="\${WCODE_NODE_VERSION:-${nodeVersion}}"
NODE_DIST_URL="\${WCODE_NODE_DIST_URL:-https://nodejs.org/dist}"
NODE_FALLBACK="\${WCODE_DIST_NODE_FALLBACK:-1}"
REQUESTED_NODE="\${WCODE_NODE_BIN:-}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "wcode install requires $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd tar

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

node_major() {
  "$1" -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0
}

is_node_ok() {
  [ -n "$1" ] && [ -x "$1" ] || return 1
  major="$(node_major "$1")"
  case "$major" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$major" -ge 24 ]
}

detect_node_platform() {
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin) node_os="darwin" ;;
    Linux) node_os="linux" ;;
    *)
      echo "Unsupported OS for automatic Node.js $NODE_VERSION download: $os. Install Node.js >= 24 manually." >&2
      exit 1
      ;;
  esac
  case "$arch" in
    arm64|aarch64) node_arch="arm64" ;;
    x86_64|amd64) node_arch="x64" ;;
    *)
      echo "Unsupported CPU architecture for automatic Node.js $NODE_VERSION download: $arch. Install Node.js >= 24 manually." >&2
      exit 1
      ;;
  esac
  printf '%s-%s' "$node_os" "$node_arch"
}

install_private_node() {
  platform_key="$(detect_node_platform)"
  node_slug="node-v\${NODE_VERSION}-\${platform_key}"
  node_archive="$TMP_DIR/\${node_slug}.tar.gz"
  node_url="\${NODE_DIST_URL%/}/v\${NODE_VERSION}/\${node_slug}.tar.gz"
  echo "Node.js >= 24 not found; installing isolated Node.js v\${NODE_VERSION} into $INSTALL_DIR/node..." >&2
  curl -fL "$node_url" -o "$node_archive"
  mkdir -p "$INSTALL_DIR/node"
  node_target="$INSTALL_DIR/node/v\${NODE_VERSION}"
  rm -rf "$node_target.new"
  mkdir -p "$node_target.new"
  tar -xzf "$node_archive" -C "$node_target.new"
  if [ ! -x "$node_target.new/\${node_slug}/bin/node" ]; then
    echo "Downloaded Node.js archive is missing \${node_slug}/bin/node" >&2
    exit 1
  fi
  rm -rf "$node_target"
  mv "$node_target.new/\${node_slug}" "$node_target"
  rm -rf "$node_target.new"
  ln -sfn "$node_target" "$INSTALL_DIR/node/current"
  if ! is_node_ok "$INSTALL_DIR/node/current/bin/node"; then
    echo "Installed private Node.js failed version check (need >= 24)." >&2
    exit 1
  fi
}

resolve_node() {
  if [ -n "$REQUESTED_NODE" ]; then
    resolved="$(command -v "$REQUESTED_NODE" 2>/dev/null || printf '%s' "$REQUESTED_NODE")"
    if ! is_node_ok "$resolved"; then
      echo "WCODE_NODE_BIN=$REQUESTED_NODE is not a runnable Node.js >= 24 binary." >&2
      exit 1
    fi
    printf '%s' "$resolved"
    return
  fi

  sys_node="$(command -v node 2>/dev/null || true)"
  if is_node_ok "$sys_node"; then
    printf '%s' "$sys_node"
    return
  fi

  if is_node_ok "$INSTALL_DIR/node/current/bin/node"; then
    printf '%s' "$INSTALL_DIR/node/current/bin/node"
    return
  fi

  if [ "$NODE_FALLBACK" = "1" ]; then
    install_private_node
    printf '%s' "$INSTALL_DIR/node/current/bin/node"
    return
  fi

  echo "wcode install requires Node.js >= 24 (set WCODE_NODE_BIN or enable WCODE_DIST_NODE_FALLBACK=1)." >&2
  exit 1
}

NODE_BIN="$(resolve_node)"

LATEST_JSON="$(curl -fsSL "\${BASE_URL%/}/latest.json")"
VERSION="$(printf '%s' "$LATEST_JSON" | "$NODE_BIN" -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(String(JSON.parse(d).version||'')))")"
TARBALL="$(printf '%s' "$LATEST_JSON" | "$NODE_BIN" -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(String(JSON.parse(d).tarball||'')))")"
TARBALL_PATH="$(printf '%s' "$LATEST_JSON" | "$NODE_BIN" -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);process.stdout.write(String(m.tarballPath||('releases/'+m.version+'/'+m.tarball)))})")"
EXPECTED_SHA256="$(printf '%s' "$LATEST_JSON" | "$NODE_BIN" -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(String(JSON.parse(d).sha256||'')))")"

if [ -z "$VERSION" ] || [ -z "$TARBALL" ]; then
  echo "Invalid latest.json metadata from \${BASE_URL%/}/latest.json" >&2
  exit 1
fi

ARCHIVE="$TMP_DIR/$TARBALL"
curl -fL "\${BASE_URL%/}/\${TARBALL_PATH#/}" -o "$ARCHIVE"

if [ -n "$EXPECTED_SHA256" ]; then
  ACTUAL_SHA256="$("$NODE_BIN" -e "const fs=require('node:fs'),c=require('node:crypto');process.stdout.write(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$ARCHIVE")"
  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    echo "wcode install checksum mismatch: expected $EXPECTED_SHA256, got $ACTUAL_SHA256" >&2
    exit 1
  fi
fi

mkdir -p "$INSTALL_DIR/releases" "$BIN_DIR"
TARGET="$INSTALL_DIR/releases/$VERSION"
rm -rf "$TARGET.new"
mkdir -p "$TARGET.new"
tar -xzf "$ARCHIVE" -C "$TARGET.new"
rm -rf "$TARGET"
mv "$TARGET.new/${packageDirName}" "$TARGET"
rm -rf "$TARGET.new"
ln -sfn "$TARGET" "$INSTALL_DIR/current"

cat > "$BIN_DIR/wcode" <<SH
#!/bin/sh
set -eu
NODE_BIN="\\\${WCODE_NODE_BIN:-}"
if [ -z "\\$NODE_BIN" ] && [ -x "$INSTALL_DIR/node/current/bin/node" ]; then
  NODE_BIN="$INSTALL_DIR/node/current/bin/node"
elif [ -z "\\$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
elif [ -z "\\$NODE_BIN" ] && [ -x "$NODE_BIN" ]; then
  NODE_BIN="$NODE_BIN"
fi
if [ -z "\\$NODE_BIN" ]; then
  echo "wcode requires Node.js >= 24" >&2
  exit 1
fi
exec "\\$NODE_BIN" "$INSTALL_DIR/current/bin/wcode.mjs" "\\$@"
SH
chmod +x "$BIN_DIR/wcode"

echo "WCode $VERSION installed."
echo "Run: wcode (TUI) or wcode --web (Web)"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Note: $BIN_DIR is not in PATH." ;;
esac
`;
}
