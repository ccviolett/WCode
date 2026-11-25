# WCode 上游同步规格说明（翻译基线分支 + 标准 `git merge`）

本文档定义 WCode 长期跟踪上游 [zai-org/ZCode](https://github.com/zai-org/ZCode) 的分支拓扑、确定性翻译脚本契约、外部契约白名单以及标准合并与校验流程，彻底取代“每次人工重新派生 + 人工重放补丁”的易偏移做法。

---

## 一、分支拓扑与所有权

```text
上游原始分支 (ZCode)                纯净翻译基线分支 (脚本生成，零手改)       WCode 主干
upstream-zcode/main                upstream/wcode-base                    main
───────────────────                ──────────────────────────────         ────────────────────
v3.18.2 (fec97590) ──[sync脚本]──▶ f58dd393 (起始共同祖先) ──────────────▶ d7d241a9..ec76b096
       │                                  │                                      │
       ▼                                  │                                      │
v4.0.0  (a4b44451) ──[sync脚本]──▶ v4.0.0-wcode ──────────────[git merge]──────▶ merge commit
       │                                  │                                      │
       ▼                                  │                                      │
v4.x    (未来版本) ──[sync脚本]──▶ v4.x-wcode   ──────────────[git merge]──────▶ merge commit
```

- **`upstream/wcode-base` 唯一所有者**：仅由 `scripts/sync-upstream.mjs` 生成与推进，**严禁在 `upstream/wcode-base` 上做任何手工业务修改**。
- **`main` 唯一所有者**：承载 WCode 全部差异化功能、品牌资源、文档与部署体系；每次升级上游时只执行标准 `git merge upstream/wcode-base`，绝不改写历史或 `git push --force`。
- **能力保留原则**：除已裁剪的 Electron 桌面交付物（`packages/desktop`、桌面专属构建/调试/E2E 脚本与 `/remote` 桌面远控入口）外，**上游所有非桌面新能力一律完整保留**（包括 `preinstalled-tools`、动态 MCP、Live Skills Catalog、工作区插件信任、Web OAuth、动态工作流等）。

---

## 二、确定性翻译契约（`scripts/sync-upstream/transform.mjs`）

### 2.1 桌面端裁剪列表（`shouldDropUpstreamPath`）

删除仅服务于 Electron 桌面交付的路径：

- `packages/desktop/**`、`docs/desktop/**`、`docs/desktop-bundle-size-architecture.md`、`docs/desktop-ci-cd.md`
- `packages/web/src/web-remote-control/**`、`packages/web/test/e2e/remote-control/**`、`packages/web/src/auth/WebLoginPage.tsx`
- `.agents/skills/e2e-case-lifecycle/**`、`.vscode/{launch.json,tasks.json,start-electron.mjs,tsup-watch.mjs,vite-dev.mjs}`
- `Dockerfile.desktop-e2e`、`package-lock.json`
- `patches/@arms__rum-electron*`、`patches/wdio-electron-service*`
- `apps/zcode-cli/packages/bootstrap/tests/browser-control-scope-owner.integration.test.ts`
- 桌面专属脚本（`scripts/*desktop*`、`scripts/check-e2e-remote-targets.mjs`、`scripts/doctor-macos-release-app.sh`、`scripts/stage-credential-keyring.mjs`、`scripts/stage-dev-cua-plugin-runtime.mjs`、`scripts/verify-electron-builder-binaries-mirror.mjs` 及对应 `scripts/test/*`）
- `packages/ui/src/assets/Z.svg`（由 `main` 上的 `W.svg` 替代）

### 2.2 路径与正文翻译（`transformPath` / `transformText`）

- 跳过改名的历史/合规路径：`docs/superpowers/**`、`docs/working-memory/**`、`LICENSE`、`THIRD-PARTY-NOTICES.md`、`third-party/upstream/**` 以及所有二进制文件。
- 其余路径与文本执行 4 组大小写对应替换：`ZCode → WCode`、`ZCODE → WCODE`、`zcode → wcode`、`Zcode → Wcode`。

### 2.3 外部服务契约保护白名单（不可破坏）

翻译前通过占位符保护、翻译后通过 `assertNoBrokenExternalContracts` 强断言校验以下上游外部契约不得被改名为 `wcode`：

1. 上游域名与完整 URL：`zcode.z.ai`、`cdn-zcode.z.ai`、`zcode.ai`（含 `https://` / `wss://` 及完整路径）。
2. 正则域名匹配：`zcode\\.z\\.ai`（与 `zcode\.z\.ai`）。
3. 套餐 API 路径段：`/api/v1/zcode-plan/*` 与 `/zcode-plan/*`。
4. CDN 官方插件路径段：`/zcode/official-plugin/*` 以及 `${OFFICIAL_PLUGIN_ASSETS_BASE_URL}/zcode-(guide|cua|site)/icon.png`。
5. 内网依赖镜像路径段：`/zcode/deps*` 以及 `:12345/zcode`、`:${INTRANET_ASSET_SERVICE_PORT}/zcode`。
6. 上游仓库引用：`zai-org/ZCode`。

### 2.4 根配置桌面条目清理（`patchConfigFile`）

对 `package.json`、`vitest.config.ts`、`.oxfmtrc.json`、`.oxlintrc.json`、`.gitignore`、`.dockerignore`、`mise.toml`、`scripts/engineering-test-files.json`、`architecture-policy.yaml` 自动移除指向已删除 `packages/desktop`、桌面脚本及桌面补丁的引用，同时保留上游新增的非桌面脚本、依赖与 `imports` 映射。

---

## 三、标准升级步骤与验收标准

1. 拉取上游最新提交：`git fetch --no-tags https://github.com/zai-org/ZCode.git refs/heads/main:refs/remotes/upstream-zcode/main`
2. 生成新翻译提交到 `upstream/wcode-base`：
   ```bash
   node scripts/sync-upstream.mjs --source upstream-zcode/main --branch upstream/wcode-base
   ```
3. 切回 `main` 执行标准合并：`git merge upstream/wcode-base`
4. 解决真实业务冲突（品牌图标与 README 保留 `main` 并更新基线版本号，代码交集逐项核对保留双边能力）。
5. 刷新衍生基线与依赖：`pnpm install`、`pnpm db:schema:update`（如 schema 有变）、刷新 `scripts/architecture/upstream-snapshot.json`（若上游架构快照更新）。
6. 验收：`node --test scripts/test/sync-upstream.test.mjs scripts/wcode-distribution.test.mjs`、`pnpm typecheck`、`pnpm lint`、`pnpm --filter @wcode/cli... build`、`pnpm --filter @wcode/server build`、`pnpm --filter @wcode/web build` 及 `pnpm verify:pre-push` 全部通过。
