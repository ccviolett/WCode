#!/usr/bin/env node
import { loadEndpointEnv } from "./load-endpoint-env.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, cp, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  copyRuntimeNodeModules,
  patchNodePtyPrebuilds,
  stageBundledSkills,
  stageTuiRuntime,
} from "./wcode-distribution/assets.mjs";
import { installScriptSource } from "./wcode-distribution/installer.mjs";

const root = resolve(import.meta.dirname, "..");
const defaultOutDir = resolve(root, "dist", "wcode");
const defaultBaseUrl = (await loadEndpointEnv()).WCODE_DIST_BASE_URL?.trim() || "";
const packageDirName = "wcode";
const usage = `Usage:
  pnpm build:wcode
  node scripts/build-wcode.mjs --skip-build
  node scripts/build-wcode.mjs --version 3.3.3-dev.1
  node scripts/build-wcode.mjs --out-dir dist/wcode
  node scripts/build-wcode.mjs --base-url http://host/wcode/deps/wcode/
  node scripts/build-wcode.mjs --flat --base-url https://github.com/ccviolett/WCode/releases/latest/download/

Options:
  --skip-build           Reuse existing web/server/agent build outputs.
  --version <text>       Release version. Defaults to root package.json version.
  --out-dir <path>       Output directory. Defaults to dist/wcode.
  --base-url <url>       Default install.sh download base URL.
  --layout <nested|flat> Release directory layout (default: nested; flat fits GitHub Releases).
  --flat                 Shorthand for --layout flat.
  --help, -h             Show this help.
`;

function readArgValue(argv, arg, index) {
  if (arg.includes("=")) {
    return {
      nextIndex: index,
      value: arg.slice(arg.indexOf("=") + 1),
    };
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${arg}`);
  }
  return {
    nextIndex: index + 1,
    value,
  };
}

function parseArgs(argv) {
  const options = {
    baseUrl: defaultBaseUrl,
    help: false,
    layout: "nested",
    outDir: defaultOutDir,
    skipBuild: false,
    version: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--skip-build") {
      options.skipBuild = true;
      continue;
    }
    if (arg === "--flat") {
      options.layout = "flat";
      continue;
    }
    if (arg === "--layout" || arg.startsWith("--layout=")) {
      const { nextIndex, value } = readArgValue(argv, arg, index);
      if (value !== "nested" && value !== "flat") {
        throw new Error(`Invalid --layout "${value}". Expected "nested" or "flat".`);
      }
      options.layout = value;
      index = nextIndex;
      continue;
    }
    if (arg === "--version" || arg.startsWith("--version=")) {
      const { nextIndex, value } = readArgValue(argv, arg, index);
      options.version = value;
      index = nextIndex;
      continue;
    }
    if (arg === "--out-dir" || arg.startsWith("--out-dir=")) {
      const { nextIndex, value } = readArgValue(argv, arg, index);
      options.outDir = resolve(root, value);
      index = nextIndex;
      continue;
    }
    if (arg === "--base-url" || arg.startsWith("--base-url=")) {
      const { nextIndex, value } = readArgValue(argv, arg, index);
      options.baseUrl = value.endsWith("/") ? value : `${value}/`;
      index = nextIndex;
      continue;
    }
    throw new Error(`Unknown option "${arg}". Run with --help for usage.`);
  }

  return options;
}

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, options = {}) {
  console.log(`[wcode] ${commandText(command, args)}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.error) {
    throw new Error(`${commandText(command, args)} failed: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(`${commandText(command, args)} failed`);
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function sha256File(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

async function assertFile(file, label) {
  const fileStat = await stat(file).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`Missing ${label}: ${file}`);
  }
}

async function assertDirectory(directory, label) {
  const directoryStat = await stat(directory).catch(() => null);
  if (!directoryStat?.isDirectory()) {
    throw new Error(`Missing ${label}: ${directory}`);
  }
}

async function buildOutputs(skipBuild) {
  if (skipBuild) {
    console.log("[wcode] skipping build; reusing existing outputs");
    return;
  }

  // Bug 原因：@wcode/shared 没有 package.json build 脚本；冷检出（CI / Docker）未先跑 typecheck 时
  // 缺少 packages/shared/dist，stageTuiRuntime 校验 TUI 闭包会直接报错 Missing @wcode/shared dist files。
  // 与 package.json 的 build:sea:prepare 保持一致，打包前显式编译 @wcode/shared。
  run("pnpm", ["exec", "tsc", "-b", "packages/shared", "--force"]);
  run("pnpm", ["--filter", "@wcode/cli...", "build"]);
  await rm(resolve(root, "packages", "server", "dist"), {
    force: true,
    recursive: true,
  });
  run("pnpm", ["--filter", "@wcode/server", "build"]);
  run("pnpm", ["--filter", "@wcode/web", "build"]);
}

/**
 * 发行包剔除 sourcemap：web 产物里 .map 占一半以上体积，终端用户不需要。
 * 保留文件内容不变，只删 .map；残留的 sourceMappingURL 注释在缺文件时会被浏览器忽略。
 */
async function stripSourceMaps(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    const fullPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      removed += await stripSourceMaps(fullPath);
    } else if (entry.name.endsWith(".map")) {
      await unlink(fullPath);
      removed += 1;
    }
  }
  return removed;
}

async function stageWCodePackage({ packageRoot, version }) {
  const webDist = resolve(root, "packages", "web", "dist");
  const serverDist = resolve(root, "packages", "server", "dist");
  const agentBundle = resolve(root, "apps", "wcode-cli", "packages", "cli", "dist", "wcode.cjs");
  const agentProvider = resolve(root, "apps/wcode-cli/packages/cli/dist/provider");

  await assertDirectory(webDist, "web dist");
  await assertDirectory(serverDist, "server dist");
  await assertFile(resolve(serverDist, "entry-http.js"), "server HTTP entry");
  await assertFile(agentBundle, "agent app-server bundle");
  await assertFile(resolve(agentProvider, "wcode-builtin.json"), "Agent provider config");

  await rm(packageRoot, {
    force: true,
    recursive: true,
  });
  await mkdir(packageRoot, {
    recursive: true,
  });

  await cp(webDist, resolve(packageRoot, "web"), {
    recursive: true,
  });
  await cp(serverDist, resolve(packageRoot, "server"), {
    recursive: true,
  });
  await mkdir(resolve(packageRoot, "agent"), {
    recursive: true,
  });
  await cp(agentBundle, resolve(packageRoot, "agent", "wcode.cjs"));
  // TUI 入口通过真正的 CLI 路径定位伴随配置；只复制 JS 会在仓库外启动失败。
  await cp(agentProvider, resolve(packageRoot, "agent/provider"), { recursive: true });
  await cp(
    resolve(root, "apps/wcode-cli/packages/cli/dist/THIRD-PARTY-NOTICES.md"),
    resolve(packageRoot, "agent/THIRD-PARTY-NOTICES.md"),
  );
  await chmod(resolve(packageRoot, "agent", "wcode.cjs"), 0o755);

  await stageBundledSkills(packageRoot);
  await stageTuiRuntime(packageRoot);
  await copyRuntimeNodeModules(packageRoot);
  await patchNodePtyPrebuilds(packageRoot);

  // 发行前统一剔除 sourcemap：必须放在 TUI 运行时与 node_modules 拷贝之后，
  // 否则后两步会把依赖包里的 .map 重新带进来。终端用户不需要这些调试产物。
  const strippedSourceMaps = await stripSourceMaps(packageRoot);
  console.log(`[wcode] stripped ${strippedSourceMaps} source map files from the release`);

  await mkdir(resolve(packageRoot, "bin"), {
    recursive: true,
  });
  const runner = resolve(packageRoot, "bin", "wcode.mjs");
  await cp(resolve(root, "scripts/wcode-distribution/runner.mjs"), runner);
  await chmod(runner, 0o755);

  // 分发本分支代码必须随附 Apache-2.0 要求的许可证、声明与修改说明，
  // 以及与该依赖集匹配的第三方许可原文；只放在源码仓库里不满足二进制分发义务。
  for (const file of ["LICENSE", "NOTICE.md", "CHANGES.md", "THIRD-PARTY-NOTICES.md"]) {
    await cp(resolve(root, file), resolve(packageRoot, file));
  }

  await writeFile(
    resolve(packageRoot, "package.json"),
    JSON.stringify(
      {
        name: "wcode-runtime",
        private: true,
        type: "module",
        version,
      },
      null,
      2,
    ),
  );
}

async function createTarball({ packageParent, releaseDir, tarballName }) {
  await mkdir(releaseDir, {
    recursive: true,
  });
  const tarball = resolve(releaseDir, tarballName);
  await rm(tarball, {
    force: true,
  });
  run("tar", ["-czf", tarball, "-C", packageParent, packageDirName]);
  return tarball;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.help && !options.baseUrl)
    throw new Error("Configure WCODE_DIST_BASE_URL in .env or pass --base-url");
  if (options.help) {
    console.log(usage);
    return;
  }

  const rootPackageJson = await readJson(resolve(root, "package.json"));
  const version = options.version ?? rootPackageJson.version;
  if (!version || typeof version !== "string") {
    throw new Error("Unable to resolve WCode version.");
  }

  await buildOutputs(options.skipBuild);

  const outDir = options.outDir;
  const workDir = resolve(outDir, ".work");
  const packageParent = workDir;
  const packageRoot = resolve(packageParent, packageDirName);
  const tarballName = `${packageDirName}-${version}.tar.gz`;
  const releaseDir = options.layout === "flat" ? outDir : resolve(outDir, "releases", version);
  const tarballPath =
    options.layout === "flat" ? tarballName : `releases/${version}/${tarballName}`;

  await rm(workDir, {
    force: true,
    recursive: true,
  });
  await stageWCodePackage({
    packageRoot,
    version,
  });
  const tarball = await createTarball({
    packageParent,
    releaseDir,
    tarballName,
  });
  const sha256 = await sha256File(tarball);
  await writeFile(resolve(releaseDir, "sha256.txt"), `${sha256}  ${tarballName}\n`);

  await writeFile(
    resolve(outDir, "latest.json"),
    JSON.stringify(
      {
        baseUrl: options.baseUrl,
        createdAt: new Date().toISOString(),
        layout: options.layout,
        name: "wcode",
        sha256,
        tarball: tarballName,
        tarballPath,
        version,
      },
      null,
      2,
    ),
  );
  const installScript = resolve(outDir, "install.sh");
  await writeFile(installScript, installScriptSource(options.baseUrl));
  await chmod(installScript, 0o755);
  await rm(workDir, {
    force: true,
    recursive: true,
  });

  console.log(`[wcode] release directory: ${outDir}`);
  console.log(`[wcode] tarball: ${tarball}`);
  console.log(`[wcode] sha256: ${sha256}`);
}

await main();
