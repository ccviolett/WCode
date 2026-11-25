/**
 * 确定性上游 ZCode -> WCode 翻译与桌面端裁剪纯函数库。
 *
 * 设计目标：
 * 1. 同一份上游提交经本模块翻译后永远产出完全一致的目录树，供 `upstream/wcode-base` 基线分支使用；
 * 2. 严格保护上游外部服务/分发契约（域名、/api/v1/zcode-plan/*、CDN 官方插件路径、/zcode/deps 等），
 *    并通过翻译后强断言防止再次出现 404 回归；
 * 3. 保留上游全部非桌面新能力（含 preinstalled-tools、动态 MCP、Live Skills、Web OAuth、DWF 等），
 *    仅裁剪已移除的 Electron 桌面端及其专属脚本/远控入口。
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const DROPPED_DIR_PREFIXES = [
  "packages/desktop/",
  "docs/desktop/",
  "packages/web/src/web-remote-control/",
  "packages/web/test/e2e/remote-control/",
  ".agents/skills/e2e-case-lifecycle/",
];

const DROPPED_EXACT_PATHS = new Set([
  ".vscode/launch.json",
  ".vscode/start-electron.mjs",
  ".vscode/tasks.json",
  ".vscode/tsup-watch.mjs",
  ".vscode/vite-dev.mjs",
  "Dockerfile.desktop-e2e",
  "apps/zcode-cli/packages/bootstrap/tests/browser-control-scope-owner.integration.test.ts",
  "docs/desktop-bundle-size-architecture.md",
  "docs/desktop-ci-cd.md",
  "package-lock.json",
  "packages/ui/src/assets/Z.svg",
  "packages/web/src/auth/WebLoginPage.tsx",
  "patches/@arms__rum-electron@0.0.3.patch",
  "patches/wdio-electron-service@9.2.1.patch",
  "scripts/build-desktop-agent-bytecode.mjs",
  "scripts/build-desktop-agent-cli.mjs",
  "scripts/check-e2e-remote-targets.mjs",
  "scripts/compile-desktop-agent-bytecode.cjs",
  "scripts/desktop-agent-bytecode-runtime.cjs",
  "scripts/dev-desktop-cua-env.mjs",
  "scripts/dev-desktop-env.mjs",
  "scripts/dev-desktop-remote-prod.mjs",
  "scripts/dev-web-remote-control-desktop.mjs",
  "scripts/doctor-macos-release-app.sh",
  "scripts/stage-credential-keyring.mjs",
  "scripts/stage-dev-cua-plugin-runtime.mjs",
  "scripts/test-desktop-e2e-container.sh",
  "scripts/test/arms-patch-install-contract.test.mjs",
  "scripts/test/e2e-remote-targets-check.test.mjs",
  "scripts/test/verify-electron-builder-binaries-mirror.test.mjs",
  "scripts/verify-electron-builder-binaries-mirror.mjs",
]);

const SKIP_PATH_RENAME_PREFIXES = ["docs/superpowers/", "docs/working-memory/"];

const SKIP_CONTENT_RENAME_PREFIXES = [
  "docs/superpowers/",
  "docs/working-memory/",
  "third-party/upstream/",
];

const SKIP_CONTENT_RENAME_EXACT = new Set(["LICENSE", "THIRD-PARTY-NOTICES.md"]);

/** 非 UTF-8 编码的测试夹具必须按原始字节拷贝，避免 UTF-8 解码破坏字节内容。 */
const RAW_COPY_EXACT = new Set(["apps/zcode-cli/tests/gb2312.js"]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".icns",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".xz",
  ".bz2",
  ".7z",
  ".wasm",
  ".node",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".pptx",
  ".docx",
  ".xlsx",
  ".sqlite",
  ".db",
]);

/**
 * 外部服务契约保护规则：在全局 zcode->wcode 替换前临时用哨兵占位，替换完成后原样还原。
 * 顺序按从长到短排列，避免短模式提前切碎完整 URL。
 */
const PROTECTED_EXTERNAL_PATTERNS = [
  // 1. 完整上游外部 URL（zcode.z.ai / cdn-zcode.z.ai / zcode.ai 及其路径段，含 zcode-plan 与 official-plugin/assets/zcode-*）
  /(?:https?|wss?):\/\/(?:[a-z0-9-]+\.)*zcode(?:\.z)?\.ai(?:\/[^\s"'`<>)}\]\\]*)?/gi,
  // 2. JSON/JS 正则中的转义上游域名与路径（如 https://zcode\\.z\\.ai/api/v1/zcode-plan/...）
  /https?:\/\/(?:[a-z0-9-]+\\{0,2}\.)*zcode\\{1,2}\.z\\{1,2}\.ai(?:\/[^\s"'`<>)}\]]*)?/gi,
  // 3. 上游 GitHub 仓库与组织链接
  /https?:\/\/github\.com\/zai-org\/ZCode(?:\/[^\s"'`<>)}\]]*)?/gi,
  /\bzai-org\/ZCode\b/g,
  // 4. 相对路径形式的上游外部 API 与 CDN 官方插件路径
  /\/api\/v1\/zcode-plan(?:\/[^\s"'`<>)}\]]*)?/g,
  /\/zcode-plan(?:\/[^\s"'`<>)}\]]*)?/g,
  /\/zcode\/official-plugin(?:\/[^\s"'`<>)}\]]*)?/g,
  /\$\{OFFICIAL_PLUGIN_ASSETS_BASE_URL\}\/zcode-(?:guide|cua|site)\/icon\.png/g,
  // 5. 内网依赖镜像外部路径契约（/zcode/deps 及 :PORT/zcode）
  /:\$\{INTRANET_ASSET_SERVICE_PORT\}\/zcode(?:\/[^\s"'`<>)}\]]*)?/g,
  /:12345\/zcode(?:\/[^\s"'`<>)}\]]*)?/g,
  /\/zcode\/deps(?:\/[^\s"'`<>)}\]]*)?/g,
  // 6. 裸域名（无协议前缀）
  /\b(?:cdn-)?zcode\.z\.ai\b/gi,
  /\bzcode\.ai\b/gi,
];

/** 翻译后绝不允许出现的外部契约破坏模式（触发即抛错中止同步）。 */
const FORBIDDEN_BROKEN_CONTRACT_RULES = [
  { name: "broken-plan-api-path", pattern: /\/api\/v1\/wcode-plan\b/ },
  { name: "broken-cdn-official-plugin", pattern: /cdn-zcode\.z\.ai\/wcode\/official-plugin/ },
  { name: "broken-base-url-match-regex", pattern: /wcode\\{1,2}\.z\\{1,2}\.ai/ },
  {
    name: "broken-intranet-deps-path",
    pattern: /(?::12345|INTRANET_ASSET_SERVICE_PORT\})\/wcode(?:\/deps|\b)/,
  },
  {
    name: "broken-official-plugin-icon-dir",
    pattern: /OFFICIAL_PLUGIN_ASSETS_BASE_URL\}\/wcode-(?:guide|cua|site)\/icon\.png/,
  },
];

const REMOVED_DESKTOP_SCRIPTS = new Set([
  "build:desktop-agent:bytecode",
  "bundle:desktop",
  "check:e2e-remote-targets",
  "ci:verify-electron-builder-mirror",
  "dev:desktop",
  "dev:desktop:bytecode",
  "dev:desktop:prod",
  "dev:desktop:remote-prod",
  "dev:desktop:test",
  "dev:web-remote-control",
  "doctor:macos-release",
  "prepare:desktop-runtime",
  "test:e2e",
  "test:e2e:all:coverage",
  "test:e2e:container",
  "test:e2e:container:conversation",
  "test:e2e:container:plugins",
  "test:e2e:windows:sharded",
]);

export function shouldDropUpstreamPath(relPath) {
  if (DROPPED_EXACT_PATHS.has(relPath)) return true;
  if (DROPPED_DIR_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return true;
  if (relPath.startsWith("patches/@arms__rum-electron@")) return true;
  if (relPath.startsWith("patches/wdio-electron-service@")) return true;
  return false;
}

export function isBinaryPath(relPath) {
  if (RAW_COPY_EXACT.has(relPath)) return true;
  const dot = relPath.lastIndexOf(".");
  if (dot < 0) return false;
  return BINARY_EXTENSIONS.has(relPath.slice(dot).toLowerCase());
}

export function shouldSkipContentRename(relPath) {
  if (SKIP_CONTENT_RENAME_EXACT.has(relPath)) return true;
  return SKIP_CONTENT_RENAME_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

export function transformPath(relPath) {
  if (SKIP_PATH_RENAME_PREFIXES.some((prefix) => relPath.startsWith(prefix))) {
    return relPath;
  }
  return relPath
    .replaceAll("ZCode", "WCode")
    .replaceAll("ZCODE", "WCODE")
    .replaceAll("zcode", "wcode")
    .replaceAll("Zcode", "Wcode");
}

export function transformText(text, relPath = "") {
  if (shouldSkipContentRename(relPath)) return text;

  const saved = [];
  let masked = text;
  for (const pattern of PROTECTED_EXTERNAL_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      const idx = saved.length;
      saved.push(match);
      return `\u0000WCODE_KEEP_${idx}\u0000`;
    });
  }

  let renamed = masked
    .replaceAll("ZCode", "WCode")
    .replaceAll("ZCODE", "WCODE")
    .replaceAll("zcode", "wcode")
    .replaceAll("Zcode", "Wcode");

  // 逐条反向还原占位符，兼容嵌套保护场景。
  for (let idx = saved.length - 1; idx >= 0; idx -= 1) {
    renamed = renamed.replaceAll(`\u0000WCODE_KEEP_${idx}\u0000`, saved[idx]);
  }

  // `packages/shared/src/mcp.ts` 中的 Python CUA 包名（PyPI 真实包名为 zcode-cua）保留双兼容匹配。
  if (relPath === "packages/shared/src/mcp.ts") {
    renamed = renamed.replace(
      'return c === "wcode-cua" || /^wcode-cua(?:\\.|@|\\[|==|$)/.test(c);',
      'return (\n    c === "zcode-cua" ||\n    /^zcode-cua(?:\\.|@|\\[|==|$)/.test(c) ||\n    c === "wcode-cua" ||\n    /^wcode-cua(?:\\.|@|\\[|==|$)/.test(c)\n  );',
    );
  }

  return renamed;
}

export function assertNoBrokenExternalContracts(text, relPath) {
  if (shouldSkipContentRename(relPath)) return;
  for (const rule of FORBIDDEN_BROKEN_CONTRACT_RULES) {
    const match = rule.pattern.exec(text);
    if (match) {
      throw new Error(
        `[sync-upstream] external contract violation (${rule.name}) in ${relPath}: matched "${match[0]}"`,
      );
    }
  }
}

/** 清理根 package.json 中的桌面端专属脚本与补丁引用，完整保留上游新增的非桌面脚本/依赖/imports。 */
function patchRootPackageJson(text) {
  const pkg = JSON.parse(text);
  if (pkg.scripts && typeof pkg.scripts === "object") {
    for (const key of REMOVED_DESKTOP_SCRIPTS) {
      delete pkg.scripts[key];
    }
    if (typeof pkg.scripts["build:bootstrap"] === "string") {
      pkg.scripts["build:bootstrap"] = 'pnpm -r --filter "./packages/*" build';
    }
    if (typeof pkg.scripts["verify:pre-push"] === "string") {
      pkg.scripts["verify:pre-push"] = pkg.scripts["verify:pre-push"].replace(
        " && pnpm run check:e2e-remote-targets",
        "",
      );
    }
    if (typeof pkg.scripts["test:engineering-tools"] === "string") {
      pkg.scripts["test:engineering-tools"] = pkg.scripts["test:engineering-tools"].replace(
        " scripts/test/e2e-remote-targets-check.test.mjs",
        "",
      );
    }
    if (typeof pkg.scripts.typecheck === "string") {
      pkg.scripts.typecheck = pkg.scripts.typecheck
        .replace(" && tsc -p packages/desktop/tsconfig.remote-main.json --noEmit", "")
        .replace(/ packages\/desktop\/tsconfig\.[a-z-]+\.json/g, "");
    }
  }
  if (pkg.pnpm?.patchedDependencies) {
    for (const key of Object.keys(pkg.pnpm.patchedDependencies)) {
      if (key.startsWith("@arms/rum-electron@") || key.startsWith("wdio-electron-service@")) {
        delete pkg.pnpm.patchedDependencies[key];
      }
    }
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function patchEngineeringTestFilesJson(text) {
  const list = JSON.parse(text);
  const filtered = list.filter(
    (entry) =>
      typeof entry === "string" &&
      !entry.startsWith("packages/desktop/") &&
      !entry.includes("web-remote-control"),
  );
  return `${JSON.stringify(filtered, null, 2)}\n`;
}

function patchVitestConfig(text) {
  return text
    .replace(/\s*"@desktop": resolve\(__dirname, "packages\/desktop\/src"\),\n/, "\n")
    .replace(
      /\s*\/\/ 间接 import desktopNetworkTelemetry[\s\S]*?"@arms\/rum-electron": resolve\([\s\S]*?\),\n/,
      "\n",
    );
}

function patchOxfmtConfig(text) {
  return text.replace(
    /\s*"packages\/desktop\/src\/renderer\/src\/plugin-sandbox\/genUiTweakRuntime\.js",\n/,
    "\n",
  );
}

function patchOxlintConfig(text) {
  return text.replace(
    /\s*"\*\*\/packages\/desktop\/test\/e2e\/helpers\/web-remote-visibility-browser\.ts",\n/,
    "\n",
  );
}

function patchMiseToml(text) {
  return text
    .replace(/ELECTRON_MIRROR = .*\n/, "")
    .replace(
      /\[tasks\.dev\]\n[\s\S]*?\[tasks\.dev-web\]/,
      '[tasks.dev]\ndescription = "Start the web server and client dev servers."\nrun = "mise exec -- node scripts/mise-run.mjs pnpm dev:web"\n\n[tasks.dev-web]',
    )
    .replace(/\[tasks\.dev-remote\]\n[\s\S]*?\n\n/, "");
}

function patchArchitecturePolicyYaml(text) {
  const doc = parseYaml(text);
  const isDroppedRoot = (rootPath) =>
    typeof rootPath === "string" &&
    (rootPath.startsWith("packages/desktop") ||
      rootPath.startsWith("packages/web/src/web-remote-control"));

  const droppedIds = new Set();
  if (Array.isArray(doc.modules)) {
    doc.modules = doc.modules.filter((mod) => {
      const roots = Array.isArray(mod.roots) ? mod.roots : [];
      if (roots.length > 0 && roots.every(isDroppedRoot)) {
        droppedIds.add(mod.id);
        return false;
      }
      if (roots.some(isDroppedRoot)) {
        mod.roots = roots.filter((r) => !isDroppedRoot(r));
      }
      if (Array.isArray(mod.publicEntrypoints)) {
        mod.publicEntrypoints = mod.publicEntrypoints.filter((e) => !isDroppedRoot(e));
      }
      return true;
    });
    for (const mod of doc.modules) {
      if (Array.isArray(mod.requires)) {
        mod.requires = mod.requires.filter((dep) => !droppedIds.has(dep));
      }
    }
  }
  if (Array.isArray(doc.exceptions)) {
    doc.exceptions = doc.exceptions.filter((exc) => {
      const from = exc?.from ?? "";
      const to = exc?.to ?? "";
      const file = exc?.file ?? "";
      if (isDroppedRoot(file) || isDroppedRoot(from) || isDroppedRoot(to)) return false;
      if (droppedIds.has(from) || droppedIds.has(to)) return false;
      return true;
    });
  }
  return stringifyYaml(doc, { lineWidth: 100 });
}

function patchPackageNativeSearchTools(text) {
  return text.replace(
    'createRequire(join(repoRoot, "packages/desktop/package.json"))',
    'createRequire(join(repoRoot, "package.json"))',
  );
}

/** 针对少量引用 packages/desktop 的配置文件执行确定性裁剪，避免上游同步把桌面死引用带回。 */
export function patchConfigFile(text, targetRelPath) {
  switch (targetRelPath) {
    case "package.json":
      return patchRootPackageJson(text);
    case "scripts/engineering-test-files.json":
      return patchEngineeringTestFilesJson(text);
    case "vitest.config.ts":
      return patchVitestConfig(text);
    case ".oxfmtrc.json":
      return patchOxfmtConfig(text);
    case ".oxlintrc.json":
      return patchOxlintConfig(text);
    case "mise.toml":
      return patchMiseToml(text);
    case "architecture-policy.yaml":
      return patchArchitecturePolicyYaml(text);
    case "scripts/package-native-search-tools.mjs":
      return patchPackageNativeSearchTools(text);
    default:
      return text;
  }
}
