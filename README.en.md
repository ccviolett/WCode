# WCode

<div align="center">
  <img src="public/logo/icons/1024x1024.png" alt="WCode" width="128" height="128" />
</div>
<p align="center">
  <a href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=47ag983c-8fcb-4d6d-814b-5395193a712c&amp;qr_code=true">Feishu community</a> ·
  <a href="https://discord.gg/z9aBcQXZQ3">Discord</a>
</p>
<p align="center">
  <a href="README.md">简体中文</a> | English
</p>

WCode is an AI coding workspace with browser and terminal interfaces. This repository has been trimmed to keep only the Web client and shared runtime sources; the desktop application and its dedicated build, debug, and packaging tools have been removed. This repository contains the clients, backend services, shared UI, and Agent CLI and runtime source code.

## Updates

- **2026-11-12**: Updated to WCode v3.18.2.
- 2026-11-12: Updated to WCode v3.18.1.
- 2026-11-11: Updated to WCode v3.18.0.
- 2026-11-03: Updated to WCode v3.17.2.
- 2026-10-30: Updated to WCode v3.17.1.
- 2026-10-29: Updated to WCode v3.17.0.
- 2026-10-19: Updated to WCode v3.16.2.
- 2026-10-16: Updated to WCode v3.16.1.
- 2026-10-16: Updated to WCode v3.15.4.
- 2026-10-10: Updated to WCode v3.15.1.
- 2026-9-23: Updated to WCode v3.14.3.

## Setup

Install Git, Node.js **24.14.0**, and pnpm **10.33.2**. [mise.toml](mise.toml) is the source of truth for tool versions. Run all development and packaging commands below from the repository root.

```bash
pnpm bootstrap
```

`pnpm bootstrap` installs workspace dependencies and runs `build:bootstrap`.

The Agent CLI and runtime source code lives in [apps/wcode-cli/](apps/wcode-cli/) as a regular directory included when you clone this repository. No separate checkout or Git submodule initialization is required.

Additional setup and build commands:

| Command                        | Purpose                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                 | Install dependencies                                                                                                                |
| `pnpm prepare:remote-assets`   | Prepare remote runtime assets separately                                                                                            |
| `pnpm bootstrap:with-remote`   | Set up dependencies and local and remote assets, then build the relevant packages sequentially                                      |
| `pnpm build`                   | Recursively run each workspace package's build script, including its asset preparation steps                                        |

The default `bootstrap` skips remote asset preparation and is suitable for local Web development. Run the corresponding preparation command when working with remote workspaces or validating remote distribution assets.

## Development and Usage

### Web Development

Use development mode when editing Web or backend source code:

```bash
pnpm dev:web

# Set the backend workspace (macOS / Linux)
WCODE_SERVER_WORKSPACE=/path/to/project pnpm dev:web
```

This starts both the Web development server (default: `http://localhost:5173`) and the backend (default: `http://localhost:3030`). Open the Web development server in your browser. `/ws` and general `/api` requests are proxied to the local backend; `/api/v1/oauth/token` is proxied separately to the configured product service.

After changing Agent source code, run `pnpm --filter @wcode/cli... build` and restart the service. To validate the complete distribution, extract and run it as described under Packaging → WCode CLI distribution below.

### WCode CLI distribution

The command-line distribution includes the TUI, Web client, and Agent behind one `wcode` command. With no arguments it starts the TUI; a leading `--web` starts Web mode; all other arguments go to the existing Agent CLI. Both modes run locally without Electron.

```bash
# Start the terminal UI by default
wcode

# Start the Web interface
wcode --web

# Set the project and port without opening a browser automatically
wcode --web --workspace /path/to/project --port 3030 --no-open

# Show CLI or Web options
wcode --help
wcode --web --help
```

In Web mode, it uses the current directory as the workspace, listens on `127.0.0.1` without token authentication by default, selects an available port, and opens a browser. Use the URL printed in the terminal and press `Ctrl+C` to stop the service. For LAN access, use `--host 0.0.0.0`; listening on a non-local address generates an access token by default. Use the token-bearing URL printed in the terminal. Set a token with `--token`, or disable token authentication with `--no-token`.

When starting the general Web service's HTTP entry directly, configure API/WebSocket authentication with `WCODE_SERVER_AUTH_TOKEN`. When creating the service programmatically, use the `authToken` option.

See Packaging below for build instructions. `pnpm build:wcode` only creates the distribution; it does not replace an existing `wcode` on `PATH`. If the command still points to an older installation or another checkout, check it with `command -v wcode` on macOS / Linux or `where.exe wcode` on Windows.

### CLI Source Development

See the [CLI usage guide (Chinese)](apps/wcode-cli/docs/usage/README.md) for model configuration, non-interactive runs, tools and extensions, batch evaluation, and trajectory capture.

Use the source entry when developing the TUI or Agent:

```bash
pnpm --filter @wcode/cli dev --help
pnpm --filter @wcode/cli dev

# Build the CLI and its workspace dependencies
pnpm --filter @wcode/cli... build
node apps/wcode-cli/packages/cli/dist/wcode.cjs --help
```

This entry runs the Agent CLI directly and does not handle the distribution's `--web` switch. Use `pnpm dev:web` for Web development, or the extracted `bin/wcode.mjs` shown below to test the unified command.

### UI Plugin development

See the [UI Plugin guide](UI_PLUGIN.en.md) for the Excalidraw workflow, supported APIs, plugin installation and updates, and host debugging.

**Plugin PRs in `wcode-plugins` must declare whether they affect a UI Plugin and list the plugin names in the PR template.** See the [required plugin-type declaration](UI_PLUGIN.en.md#declare-the-plugin-type-in-pull-requests).

## Model configuration (required before first use)

This repository ships no model credentials. The UI opens without one, but **you must configure a model before sending messages**, otherwise the composer reports the model is unavailable. Pick one of two options.

### Option 1: sign in to a WCode account

Use the sign-in entry in the app (top-right or the connection panel), or sign in from the CLI:

```bash
pnpm --filter @wcode/cli exec tsx src/main.ts login
```

Your account's available models are then ready to use; no API key needed.

Run `pnpm bootstrap` (or at least `pnpm install`) first, otherwise workspace dependencies are missing.

### Option 2: configure your own model service

Works with any OpenAI Chat Completions, OpenAI Responses, or Anthropic Messages compatible endpoint.

1. Create a personal config file following the `schemaVersion: 1` format in the [CLI configuration docs](apps/wcode-cli/docs/usage/03-config.md#个人模型配置示例) (any path, e.g. `~/.wcode/model-config.json`), replacing `providerId`, `baseUrl`, `apiKey`, and the model name.

2. Point the environment variable at it and start:

   ```bash
   WCODE_BUILTIN_PROVIDER_CONFIG_FILE=/absolute/path/model-config.json pnpm dev:web
   ```

Supported `api.type` values: `openai-chat-completions`, `openai-responses`, `anthropic-messages`. The endpoint must support the chosen protocol and tool calling.

> The personal config file contains a plaintext API key. Restrict its permissions and never commit it.

### Local data directory

Application data is written to `~/.wcode/v2/` (sessions, settings, sign-in state). Legacy ZCode used `~/.zcode`; the two are **independent and not migrated automatically** — copy the relevant files yourself if you need old sessions.

## Configuration

The root [.env.example](.env.example) provides sample service URLs and build configuration. Copy it to `.env` as needed and place local overrides in `.env.local`.

| Setting                              | Purpose                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `WCODE_DATA_BASE_DIR`                | Base directory for application data, stored under its `.wcode/` subdirectory            |
| `WCODE_SERVER_WORKSPACE`             | Workspace path for the Web backend                                                      |
| `WCODE_BUILTIN_PROVIDER_CONFIG_FILE` | Path to a local provider configuration file; uses the built-in configuration when unset |
| `WCODE_DIST_BASE_URL`                | Download base URL used by the CLI distribution installer                                |

Runtime variables can be set explicitly in the environment of the startup command. See [config/README.md](config/README.md) for the default configuration shipped with the client.

## Packaging

See [third-party/README.md](third-party/README.md) for notice generation, distribution checks, and where the notices are included in each distribution.

### WCode CLI distribution

Run `pnpm build:wcode` to build the CLI/TUI, backend, and Web client, collect the TUI native libraries, workers, and runtime dependencies, then assemble the distribution. Running the distribution still requires Node.js; use the version specified in `mise.toml`.

Before packaging, set the download base URL with `WCODE_DIST_BASE_URL` in `.env`, `.env.local`, or the process environment, or pass it through `--base-url`. The URL below is a placeholder; replace it with your hosting URL when publishing:

```bash
pnpm build:wcode --base-url https://downloads.example.com/wcode/

# When WCODE_DIST_BASE_URL is already configured
pnpm build:wcode

# Repackage existing Agent, backend, and Web build outputs
pnpm build:wcode --skip-build

# Show options for the version, output directory, and more
pnpm build:wcode --help
```

The version defaults to the root `package.json` version. Output is written to `dist/wcode/`:

- `releases/<version>/wcode-<version>.tar.gz`: runtime package.
- `releases/<version>/sha256.txt`: checksum file.
- `latest.json` and `install.sh`: version index and installer.

Upload the entire directory to the configured download base URL. The installer downloads the runtime package from that URL, installs it to `~/.wcode/runtime` by default, and creates the `wcode` command in `~/.local/bin`. Override these directories with `WCODE_DIST_HOME` and `WCODE_DIST_BIN_DIR`, respectively.

Existing Lite users should switch to the new build command, environment variables, and installer. Installation does not remove old Lite directories or migrate/delete session data.

To test a packaged build locally, extract and run it directly without uploading or installing it:

```bash
wcode_version=$(node -p "require('./dist/wcode/latest.json').version")
mkdir -p dist/wcode/debug
tar -xzf "dist/wcode/releases/$wcode_version/wcode-$wcode_version.tar.gz" \
  -C dist/wcode/debug
# Start the TUI by default
node dist/wcode/debug/wcode/bin/wcode.mjs

# Start Web mode
node dist/wcode/debug/wcode/bin/wcode.mjs --web \
  --workspace "$PWD" --port 3030 --no-open
```

Open `http://127.0.0.1:3030` to validate the complete flow, with one backend serving the Web pages and running the Agent. The port must be available; if `pnpm dev:web` is already running, choose another `--port`.

## Repository Structure

| Directory                                            | Responsibility                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/web`                                       | Web client                                                                              |
| `packages/server`                                    | HTTP / WebSocket services and remote connections                                        |
| `packages/wcode-server-cli`                          | Standalone server startup and process management                                        |
| `packages/ui`                                        | Shared React components, hooks, and Zustand state                                       |
| `packages/services`                                  | Business services and persistence                                                       |
| `packages/shared`, `packages/rpc`, `packages/client` | Shared protocols and types, RPC framework, and Agent client SDK                         |
| `packages/provider`, `packages/provider-node`        | Common provider capabilities and Node implementations                                   |
| `apps/wcode-cli`                                     | Agent CLI, TUI, runtime, and tools                                                      |
| `scripts`, `config`, `third-party`                   | Build and maintenance scripts, built-in configuration, and third-party notice materials |

## License

This repository is derived from [zai-org/ZCode](https://github.com/zai-org/ZCode) (v3.18.2, baseline commit `fec97590`)
and remains under the **Apache License 2.0**; see [LICENSE](LICENSE). The full license text keeps that version's
copyright line.

When redistributing sources, binaries, or images, ship these files together:

| File | Purpose |
| --- | --- |
| [LICENSE](LICENSE) | Apache-2.0 license text (including the upstream copyright line) |
| [NOTICE.md](NOTICE.md) | Origin and trademark statement, execution and data risk notes |
| [CHANGES.md](CHANGES.md) | Changes relative to upstream (required by Apache-2.0 §4(b)) |
| [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) | License texts for third-party dependencies and assets |

`pnpm build:wcode` already places all four files in the root of the generated distribution.

WCode is an independently maintained fork. It is not an official Z.ai project and is not endorsed or sponsored by
Z.ai; the "ZCode" and "Z.ai" names and marks belong to their respective owners. See
[third-party/README.md](third-party/README.md) for maintaining and regenerating third-party materials.

## Project Notice

See [NOTICE.md](NOTICE.md) for feature and promotion scope, maintenance policy, execution and data risks, licensing, and third-party copyright information.
