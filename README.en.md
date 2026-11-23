# WCode

<div align="center">
  <img src="public/logo/icons/1024x1024.png" alt="WCode" width="120" height="120" />
</div>

<p align="center">
  <a href="README.md">简体中文</a> | English
</p>

<p align="center">
  A lightweight Web-only, standalone Server, and Agent CLI/TUI fork of <a href="https://github.com/zai-org/ZCode">zai-org/ZCode</a> (<code>v3.18.2</code>)
</p>

---

WCode is tailored for **local browser, LAN, and self-hosted server deployments**. While preserving the full Web workspace and Agent CLI/TUI experience, it removes Electron desktop coupling and focuses on standalone Web usability, out-of-the-box server authentication, Dynamic Workflow ergonomics, and slim unified distribution.

> **About Upstream**: For ZCode's core AI coding capabilities, Agent runtime design, and general feature documentation, please refer directly to [zai-org/ZCode](https://github.com/zai-org/ZCode). This README focuses on **what WCode optimizes over ZCode** and **how to build, run, and deploy WCode**.

## What WCode Optimizes over ZCode

| Area                                     | Upstream ZCode                                                                                                         | WCode Optimizations                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime Footprint & Platform**         | Bundles Electron desktop app, `packages/desktop`, `/remote` desktop remote control, and desktop build/E2E dependencies | **Pure Web + standalone HTTP/WS Server + Agent CLI/TUI**; completely removes `packages/desktop`, `/remote`, and Electron/WDIO/`@arms/rum-electron` dependencies; downgrades `window-controller` to optional                                                                                                                                                                                                              |
| **Standalone Web & Host Capabilities**   | File reveal/open relies on desktop host or fragmented UI checks; defaults to fixed dark theme                          | Server auto-detects `deployment.mode` (`local` / `server`); enables `realpath`-whitelisted host actions (reveal in Finder/Explorer, default app open, VS Code open across all registered project roots) on local GUI hosts while automatically hiding local-only controls on remote access; defaults to system theme; Web dev server defaults to port `5183`                                                             |
| **Out-of-the-Box Server Auth**           | Manual static token management for non-loopback hosts; URL tokens remain in browser history and Referer headers        | Automatically generates a **one-time access token** when binding a non-loopback host without a configured token; first navigation exchanges it for an `HttpOnly` session cookie (`Secure` behind TLS proxies) and `302`-redirects to strip the token from the URL; also supports `Authorization: Bearer` and `WCODE_SERVER_AUTH_TOKEN`                                                                                   |
| **Web Dynamic Workflows (DWF)**          | Offline/unconfigured mode depends on remote toggles; artifact open assumes desktop `file://` access                    | Defaults `DEFAULT_DYNAMIC_WORKFLOW_MODE` to `onDemand` when offline or unconfigured (keeps `/workflow` and Automation → Workflows ready without injecting workflow tools into regular chats); opens HTML workflow artifacts in the system browser locally via `system.openPath` and falls back to workspace file-tree reveal remotely; bundles `bundled-skills` into releases and adds an illustrated architecture guide |
| **Unified Slim Distribution**            | Separate desktop packaging; ships `.map` sourcemaps in distribution artifacts                                          | `pnpm build:wcode` produces a single `wcode` entry (`wcode` for TUI, `wcode --web` for Web), strips all `.map` files to shrink archive size, validates & packages `agent/packages/bundled-skills`, and includes all four Apache-2.0 compliance files at archive root                                                                                                                                                     |
| **Brand Isolation & Upstream Contracts** | Shares `@zcode/*`, `~/.zcode`, and `ZCODE_*` namespaces                                                                | Fully isolates package scope (`@wcode/*`), CLI binary (`wcode`), env vars (`WCODE_*`), data dir (`~/.wcode/v2/`), and W-series logo while **strictly preserving upstream external service contracts** (`zcode.z.ai`, `/api/v1/zcode-plan/*`, `cdn-zcode.z.ai/zcode/official-plugin/*`, `/zcode/deps`, PyPI `zcode-cua`) so official login, plan checks, model matching, and plugin marketplace work without 404s         |

For the complete technical changelog and upgrade notes, see [CHANGES.md](CHANGES.md).

### Key Highlights

- **Automatic Local vs. Remote Awareness**: The server infers `deployment.mode` from proxy forwarding headers and peer loopback checks (overridable via `WCODE_DEPLOYMENT_MODE`). Local browser sessions get desktop-like host integration across every registered project root (disableable via `WCODE_ALLOW_HOST_REVEAL=0`), whereas remote server sessions automatically hide host-only actions that would otherwise trigger unseen on the server.
- **Dynamic Workflows (DWF) Ready Out of the Box**: Without an upstream feature-flag server, the Web/Server Host defaults to `onDemand`—keeping normal chats lightweight while leaving `/workflow` and Automation → Workflows immediately usable. See the [WCode Dynamic Workflow Definition & Boundaries Guide](docs/dynamic-workflow/wcode-definition-and-boundaries.md) (Chinese, with 4 SVG architecture diagrams).
- **Safe Defaults for Self-Hosting**: `wcode --web` binds `127.0.0.1` without auth for frictionless local usage; binding `0.0.0.0` or another non-loopback address without a static token automatically switches to one-time token → `HttpOnly` cookie session bootstrap.

---

## Quick Start

### Prerequisites

Install Git, Node.js **24.14.0**, and pnpm **10.33.2** (pinned in [mise.toml](mise.toml)). Run all commands below from the repository root.

```bash
pnpm bootstrap
```

`pnpm bootstrap` installs workspace dependencies and runs `build:bootstrap`. The Agent CLI and runtime live in [apps/wcode-cli/](apps/wcode-cli/) as a regular directory (no Git submodule required). Run `pnpm bootstrap:with-remote` or `pnpm prepare:remote-assets` only when preparing remote runtime assets.

### Option 1: Source Development Mode (Web + Server)

```bash
pnpm dev:web

# Specify the backend workspace
WCODE_SERVER_WORKSPACE=/path/to/project pnpm dev:web
```

- Web UI runs at `http://localhost:5183` and proxies API/WebSocket traffic to the backend at `http://localhost:3030`.
- After editing [apps/wcode-cli/](apps/wcode-cli/), rebuild via `pnpm --filter @wcode/cli... build` and restart the server.
- To develop the CLI / TUI directly, run `pnpm --filter @wcode/cli dev`.

### Option 2: Unified CLI & Web Runtime (`wcode` / `wcode --web`)

Using the packaged unified `wcode` binary (built via `pnpm build:wcode` below), with no Electron required:

```bash
# Start interactive terminal TUI
wcode

# Start local Web workspace (binds 127.0.0.1, picks a free port, opens browser)
wcode --web

# LAN / Server mode (auto-generates a one-time ?token= bootstrap URL on non-loopback hosts)
wcode --web --host 0.0.0.0 --port 3030 --workspace /path/to/project --no-open

# Use a static token (or set WCODE_SERVER_AUTH_TOKEN)
wcode --web --host 0.0.0.0 --port 3030 --token <your-token> --no-open

# View all options
wcode --help
wcode --web --help
```

> For public internet exposure, always place WCode behind an HTTPS reverse proxy; the session cookie automatically sets `Secure` when TLS is terminated upstream.

### Model Configuration (Required Before First Message)

This repository ships with no model credentials. Choose either option:

1. **Account Sign-In**: Sign in from the Web UI top-right menu, or run via CLI:
   ```bash
   pnpm --filter @wcode/cli exec tsx src/main.ts login
   ```
2. **Custom Model Provider** (supports `openai-chat-completions`, `openai-responses`, and `anthropic-messages`):
   Create a `schemaVersion: 1` JSON file (e.g., `~/.wcode/model-config.json`) following the [CLI Configuration Guide](apps/wcode-cli/docs/usage/03-config.md#个人模型配置示例), then launch with:
   ```bash
   WCODE_BUILTIN_PROVIDER_CONFIG_FILE=/abs/path/model-config.json pnpm dev:web
   ```
   > Personal provider files contain plaintext API keys—restrict file permissions and never commit them to Git.

Local application data is stored under `~/.wcode/v2/`, isolated from legacy `~/.zcode` with no automatic migration.

---

## Packaging & Local Verification

Build the unified distribution bundle with `pnpm build:wcode` (builds CLI/TUI, Server, and Web, strips `.map` sourcemaps, validates bundled skills, and copies Apache-2.0 compliance notices into the archive root):

```bash
# Pass --base-url or set WCODE_DIST_BASE_URL for the generated installer
pnpm build:wcode --base-url https://downloads.example.com/wcode/

# When WCODE_DIST_BASE_URL is already set
pnpm build:wcode

# Repackage without rebuilding artifacts
pnpm build:wcode --skip-build
```

Outputs are written to `dist/wcode/` (`releases/<version>/wcode-<version>.tar.gz`, `sha256.txt`, `latest.json`, `install.sh`). To verify locally without uploading:

```bash
wcode_version=$(node -p "require('./dist/wcode/latest.json').version")
mkdir -p dist/wcode/debug
tar -xzf "dist/wcode/releases/$wcode_version/wcode-$wcode_version.tar.gz" -C dist/wcode/debug

# Verify TUI
node dist/wcode/debug/wcode/bin/wcode.mjs

# Verify standalone Web server (open http://127.0.0.1:3030)
node dist/wcode/debug/wcode/bin/wcode.mjs --web --workspace "$PWD" --port 3030 --no-open
```

---

## Environment Variables

See [.env.example](.env.example) for full defaults and [config/README.md](config/README.md) for bundled configuration details.

| Variable                             | Purpose                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `WCODE_DATA_BASE_DIR`                | Base directory for application data (writes to `.wcode/` underneath)             |
| `WCODE_SERVER_WORKSPACE`             | Default workspace directory for the Web backend                                  |
| `WCODE_SERVER_AUTH_TOKEN`            | Static access token for standalone Server (compatible with `WCODE_SERVER_TOKEN`) |
| `WCODE_DEPLOYMENT_MODE`              | Explicitly override deployment mode (`local` or `server`)                        |
| `WCODE_ALLOW_HOST_REVEAL`            | Set to `0` to disable local host file reveal/open actions                        |
| `WCODE_DYNAMIC_WORKFLOW_MODE`        | Override Dynamic Workflow mode (defaults offline fallback to `onDemand`)         |
| `WCODE_BUILTIN_PROVIDER_CONFIG_FILE` | Absolute path to a custom local Provider JSON configuration                      |
| `WCODE_DIST_BASE_URL`                | Download base URL embedded in `install.sh` by `pnpm build:wcode`                 |

---

## Repository Layout & Documentation

| Path                                                 | Responsibility                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/web`                                       | Browser Web client                                                                   |
| `packages/server`                                    | Standalone HTTP / WebSocket server and remote connections                            |
| `packages/wcode-server-cli`                          | Standalone server launcher and process management                                    |
| `packages/ui`                                        | Shared React components, hooks, and Zustand stores                                   |
| `packages/services`                                  | Domain services, host reveal capabilities, and persistence                           |
| `packages/shared`, `packages/rpc`, `packages/client` | Shared protocol & types, RPC framework, Agent client SDK                             |
| `packages/provider`, `packages/provider-node`        | Provider abstractions and Node implementations                                       |
| `apps/wcode-cli`                                     | Agent CLI, TUI, runtime, tools, and bundled skills                                   |
| `docs`, `scripts`, `config`, `third-party`           | Architecture & workflow docs, build/check scripts, defaults, and third-party notices |

Further reading:

- [CHANGES.md](CHANGES.md) — Full list of modifications relative to upstream ZCode and upgrade notes
- [Dynamic Workflow (DWF) Definition & Boundaries](docs/dynamic-workflow/wcode-definition-and-boundaries.md) — Architecture & capability guide with 4 SVG diagrams (Chinese)
- [WCode CLI Usage Guide](apps/wcode-cli/docs/usage/README.md) — TUI, headless usage, config, tools, permissions, and batch automation (Chinese)
- [UI Plugin Guide](UI_PLUGIN.en.md) — UI plugin capabilities, host API, and debugging
- [Third-Party Notices Guide](third-party/README.md) — Generating and validating third-party license notices

---

## License & Attribution

WCode is derived from [zai-org/ZCode](https://github.com/zai-org/ZCode) (`v3.18.2`, baseline commit `fec97590`) and remains licensed under the **Apache License 2.0** (see [LICENSE](LICENSE)).

When redistributing source, packages, or container images, include all four compliance files (automatically placed at the archive root by `pnpm build:wcode`):

- [LICENSE](LICENSE) — Apache License 2.0 text (with upstream copyright line)
- [NOTICE.md](NOTICE.md) — Provenance, trademark notice, and execution/data risk disclosures
- [CHANGES.md](CHANGES.md) — Summary of modifications relative to upstream (Apache-2.0 §4(b))
- [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) — Third-party dependency and asset license texts

WCode is an independently maintained community fork and is **not** an official Z.ai project, nor endorsed or sponsored by Z.ai. "ZCode", "Z.ai", and related marks belong to their respective owners.
