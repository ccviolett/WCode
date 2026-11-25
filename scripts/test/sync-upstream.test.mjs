import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertNoBrokenExternalContracts,
  patchConfigFile,
  shouldDropUpstreamPath,
  transformPath,
  transformText,
} from "../sync-upstream/transform.mjs";

test("shouldDropUpstreamPath drops Electron desktop & remote-control paths but keeps Web and preinstalled-tools", () => {
  assert.equal(shouldDropUpstreamPath("packages/desktop/src/main/index.ts"), true);
  assert.equal(shouldDropUpstreamPath("docs/desktop/release.md"), true);
  assert.equal(shouldDropUpstreamPath("packages/web/src/web-remote-control/index.ts"), true);
  assert.equal(shouldDropUpstreamPath("patches/@arms__rum-electron@0.0.3.patch"), true);
  assert.equal(shouldDropUpstreamPath("scripts/dev-desktop-env.mjs"), true);

  // 必须保留上游全部非桌面新能力
  assert.equal(
    shouldDropUpstreamPath("packages/ui/src/preinstalled-tools/PreinstalledToolsDialog.tsx"),
    false,
  );
  assert.equal(shouldDropUpstreamPath("scripts/check-document-libreoffice.mjs"), false);
  assert.equal(
    shouldDropUpstreamPath("apps/zcode-cli/packages/core/src/mcp/runtime/session.ts"),
    false,
  );
  assert.equal(shouldDropUpstreamPath("packages/web/src/auth/webAuthService.ts"), false);
});

test("transformPath renames ZCode namespaces while preserving historical doc paths", () => {
  assert.equal(
    transformPath("apps/zcode-cli/packages/cli/src/main.ts"),
    "apps/wcode-cli/packages/cli/src/main.ts",
  );
  assert.equal(
    transformPath("packages/ui/src/hooks/useZCodeTaskService.ts"),
    "packages/ui/src/hooks/useWCodeTaskService.ts",
  );
  assert.equal(
    transformPath("docs/superpowers/plans/2026-07-09-zcode-lite-static-distribution.md"),
    "docs/superpowers/plans/2026-07-09-zcode-lite-static-distribution.md",
  );
});

test("transformText renames internal identifiers while preserving all upstream external contracts", () => {
  const input = [
    'import { buildZCodeEndpointUrls } from "@zcode/shared";',
    "const ENV = process.env.ZCODE_BASE_URL;",
    'const planUrl = "https://zcode.z.ai/api/v1/zcode-plan/billing/balance";',
    'const planRel = buildRuntimeZCodeApiUrl(env, "/api/v1/zcode-plan/billing/preview");',
    'const match = "https://zcode\\\\.z\\\\.ai/api/v1/zcode-plan/anthropic/?";',
    'const cdn = "https://cdn-zcode.z.ai/zcode/official-plugin/assets/zcode-guide/icon.png";',
    "const icon = `${OFFICIAL_PLUGIN_ASSETS_BASE_URL}/zcode-cua/icon.png`;",
    "const intranet = `http://${host}:${INTRANET_ASSET_SERVICE_PORT}/zcode/deps`;",
    'const upstream = "https://github.com/zai-org/ZCode";',
  ].join("\n");

  const output = transformText(input, "packages/services/src/example.ts");
  assert.match(output, /import \{ buildWCodeEndpointUrls \} from "@wcode\/shared";/);
  assert.match(output, /process\.env\.WCODE_BASE_URL/);
  assert.match(output, /https:\/\/zcode\.z\.ai\/api\/v1\/zcode-plan\/billing\/balance/);
  assert.match(output, /buildRuntimeWCodeApiUrl\(env, "\/api\/v1\/zcode-plan\/billing\/preview"\)/);
  assert.match(output, /https:\/\/zcode\\\\\.z\\\\\.ai\/api\/v1\/zcode-plan\/anthropic\/\?/);
  assert.match(
    output,
    /https:\/\/cdn-zcode\.z\.ai\/zcode\/official-plugin\/assets\/zcode-guide\/icon\.png/,
  );
  assert.match(output, /\$\{OFFICIAL_PLUGIN_ASSETS_BASE_URL\}\/zcode-cua\/icon\.png/);
  assert.match(output, /:\$\{INTRANET_ASSET_SERVICE_PORT\}\/zcode\/deps/);
  assert.match(output, /https:\/\/github\.com\/zai-org\/ZCode/);

  assert.doesNotThrow(() =>
    assertNoBrokenExternalContracts(output, "packages/services/src/example.ts"),
  );
});

test("assertNoBrokenExternalContracts rejects broken upstream URL contracts", () => {
  assert.throws(
    () => assertNoBrokenExternalContracts('const u = "/api/v1/wcode-plan/billing";', "a.ts"),
    /broken-plan-api-path/,
  );
  assert.throws(
    () =>
      assertNoBrokenExternalContracts(
        'const u = "https://cdn-zcode.z.ai/wcode/official-plugin/marketplace.json";',
        "a.ts",
      ),
    /broken-cdn-official-plugin/,
  );
  assert.throws(
    () =>
      assertNoBrokenExternalContracts(
        '"baseUrlMatch": "https://wcode\\\\.z\\\\.ai/api/v1/highspeed/anthropic/?"',
        "a.json",
      ),
    /broken-base-url-match-regex/,
  );
});

test("patchConfigFile strips desktop scripts from package.json while keeping new non-desktop upstream entries", () => {
  const sample = JSON.stringify(
    {
      name: "wcode",
      version: "4.0.0",
      imports: { "#libreoffice/*": "./scripts/preinstalled-tools/libreoffice/*.mjs" },
      scripts: {
        "dev:web": "vite",
        "dev:desktop": "node scripts/dev-desktop-env.mjs",
        "build:bootstrap":
          'pnpm -r --filter "./packages/*" --filter "!@wcode/desktop" build && pnpm --filter @wcode/desktop build:no-runtime-assets',
        lint: "oxlint && node scripts/check-document-libreoffice.mjs",
        "verify:pre-push":
          "node scripts/check-push-worktree.mjs && pnpm run check:e2e-remote-targets && pnpm run lint",
        typecheck:
          "tsc -b packages/web packages/desktop/tsconfig.main.json && tsc -p packages/desktop/tsconfig.remote-main.json --noEmit && tsc -p packages/wcode-cua --noEmit",
      },
      pnpm: {
        patchedDependencies: {
          "vitest@4.1.7": "patches/vitest@4.1.7.patch",
          "@arms/rum-electron@0.0.3": "patches/@arms__rum-electron@0.0.3.patch",
        },
      },
    },
    null,
    2,
  );
  const patched = JSON.parse(patchConfigFile(sample, "package.json"));
  assert.equal(patched.version, "4.0.0");
  assert.equal(patched.imports["#libreoffice/*"], "./scripts/preinstalled-tools/libreoffice/*.mjs");
  assert.equal(patched.scripts["dev:desktop"], undefined);
  assert.equal(patched.scripts["build:bootstrap"], 'pnpm -r --filter "./packages/*" build');
  assert.equal(patched.scripts.lint, "oxlint && node scripts/check-document-libreoffice.mjs");
  assert.equal(
    patched.scripts["verify:pre-push"],
    "node scripts/check-push-worktree.mjs && pnpm run lint",
  );
  assert.equal(
    patched.scripts.typecheck,
    "tsc -b packages/web && tsc -p packages/wcode-cua --noEmit",
  );
  assert.equal(patched.pnpm.patchedDependencies["@arms/rum-electron@0.0.3"], undefined);
  assert.equal(patched.pnpm.patchedDependencies["vitest@4.1.7"], "patches/vitest@4.1.7.patch");
});
