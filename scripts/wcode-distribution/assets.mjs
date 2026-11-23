import { chmod, cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import {
  collectSeaTuiAssets,
  seaTuiAssetPrefix,
} from "../../apps/wcode-cli/packages/cli/scripts/sea-tui-assets.mjs";
import {
  bundledSkillPackRootPath,
  collectSeaBundledSkillAssets,
  seaBundledSkillAssetPrefix,
} from "../../apps/wcode-cli/packages/cli/scripts/sea-bundled-skill-assets.mjs";
import { supportedTargets } from "../../apps/wcode-cli/packages/cli/scripts/sea-targets.mjs";
const root = resolve(import.meta.dirname, "../..");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const runtimePackageNames = [
  "@hono/node-server",
  "@hono/node-ws",
  "ssh2",
  "node-pty",
  "undici",
  "axios",
  "form-data",
  "combined-stream",
  "follow-redirects",
  "proxy-from-env",
  "ws",
  "hono",
  "yaml",
  "yazl",
  // HTTP bundle 将 yauzl 外置；发行包必须携带它，否则脱离仓库就无法启动后端。
  "yauzl",
  "node-forge",
];

// 修复原因：dynamic-workflows 已迁出官方插件进入 packages/bundled-skills，若未随 agent/wcode.cjs
// 一起打包至 agent/packages/bundled-skills，脱离源码目录运行时技能门（428）会拒绝 CreateWorkflow 等工具。
export async function stageBundledSkills(packageRoot, options = {}) {
  const cliRoot = options.cliRoot ?? resolve(root, "apps/wcode-cli");
  const stagingDirectory = resolve(packageRoot, "../bundled-skills-staging");
  try {
    const { assets, manifest } = await collectSeaBundledSkillAssets({
      root: cliRoot,
      stagingDirectory,
    });
    for (const file of manifest.files) {
      const destination = resolve(packageRoot, "agent/packages/bundled-skills", file.path);
      await mkdir(dirname(destination), { recursive: true });
      await cp(assets[`${seaBundledSkillAssetPrefix}${file.path}`], destination);
      await chmod(destination, file.mode);
    }
    const readmePath = resolve(cliRoot, bundledSkillPackRootPath, "README.md");
    if (await pathExists(readmePath)) {
      const destination = resolve(packageRoot, "agent/packages/bundled-skills/README.md");
      await mkdir(dirname(destination), { recursive: true });
      await cp(readmePath, destination);
    }
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}

export async function stageTuiRuntime(packageRoot) {
  const stagingDirectory = resolve(packageRoot, "../tui-staging");
  const copied = new Map();
  try {
    for (const target of supportedTargets) {
      const { assets, manifest } = await collectSeaTuiAssets({
        root: resolve(root, "apps/wcode-cli"),
        stagingDirectory,
        target,
      });
      for (const file of manifest.files) {
        const previous = copied.get(file.path);
        if (previous) {
          if (previous !== file.sha256)
            throw new Error(`Conflicting TUI asset: ${file.path} (${target})`);
          continue;
        }
        const destination = resolve(packageRoot, "agent", file.path);
        await mkdir(dirname(destination), { recursive: true });
        await cp(assets[`${seaTuiAssetPrefix}${file.path}`], destination);
        await chmod(destination, file.mode);
        copied.set(file.path, file.sha256);
      }
    }
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
}
const lydellNodePtyPackages = [
  "@lydell/node-pty-darwin-arm64",
  "@lydell/node-pty-darwin-x64",
  "@lydell/node-pty-linux-arm64",
  "@lydell/node-pty-linux-x64",
];

function shouldCopyPackagePath(packageDirectory, source) {
  const rel = relative(packageDirectory, source);
  if (!rel) {
    return true;
  }
  const parts = rel.split(sep);
  return !parts.includes("node_modules") && !parts.includes(".git");
}

async function resolvePackageJsonPath(requireFrom, packageName) {
  try {
    return requireFrom.resolve(`${packageName}/package.json`);
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      throw error;
    }
    let current = dirname(requireFrom.resolve(packageName));
    for (;;) {
      const candidate = resolve(current, "package.json");
      if (await pathExists(candidate)) {
        try {
          const packageJson = await readJson(candidate);
          if (packageJson.name === packageName) {
            return candidate;
          }
        } catch {
          // Keep walking; malformed nested metadata should not pick the package root.
        }
      }
      const parent = dirname(current);
      if (parent === current) {
        throw error;
      }
      current = parent;
    }
  }
}

async function copyRuntimePackageTree({ packageName, packageRoot, requireFrom, seen }) {
  if (seen.has(packageName)) {
    return;
  }
  seen.add(packageName);

  let packageJsonPath;
  try {
    packageJsonPath = await resolvePackageJsonPath(requireFrom, packageName);
  } catch (error) {
    throw new Error(`Unable to resolve runtime package ${packageName}`, {
      cause: error,
    });
  }

  const packageDirectory = dirname(packageJsonPath);
  const destination = resolve(packageRoot, "node_modules", ...packageName.split("/"));
  await mkdir(dirname(destination), {
    recursive: true,
  });
  await cp(packageDirectory, destination, {
    dereference: true,
    force: true,
    recursive: true,
    filter: (source) => shouldCopyPackagePath(packageDirectory, source),
  });

  const packageJson = await readJson(packageJsonPath);
  const requireFromPackage = createRequire(packageJsonPath);
  const dependencies = Object.assign(
    {},
    packageJson.dependencies,
    packageJson.optionalDependencies,
  );
  for (const dependencyName of Object.keys(dependencies)) {
    try {
      await copyRuntimePackageTree({
        packageName: dependencyName,
        packageRoot,
        requireFrom: requireFromPackage,
        seen,
      });
    } catch (error) {
      if (!Object.hasOwn(packageJson.optionalDependencies ?? {}, dependencyName)) {
        throw error;
      }
      console.warn(`[wcode] optional package ${dependencyName} is unavailable; skipping`);
    }
  }
}

export async function copyRuntimeNodeModules(packageRoot) {
  const requireFromServer = createRequire(resolve(root, "packages", "server", "package.json"));
  const seen = new Set();
  for (const packageName of runtimePackageNames) {
    await copyRuntimePackageTree({
      packageName,
      packageRoot,
      requireFrom: requireFromServer,
      seen,
    });
  }
  // CLI 的浏览器运行时同样是外部依赖，不能依赖开发仓库的 hoisted node_modules。
  await copyRuntimePackageTree({
    packageName: "playwright-core",
    packageRoot: resolve(packageRoot, "agent"),
    requireFrom: createRequire(resolve(root, "apps/wcode-cli/packages/cli/package.json")),
    seen: new Set(),
  });
}

export async function patchNodePtyPrebuilds(packageRoot) {
  const requireFromServer = createRequire(resolve(root, "packages", "server", "package.json"));
  const nodePtyPrebuildRoot = resolve(packageRoot, "node_modules", "node-pty", "prebuilds");

  for (const packageName of lydellNodePtyPackages) {
    let packageJsonPath;
    try {
      packageJsonPath = await resolvePackageJsonPath(requireFromServer, packageName);
    } catch {
      console.warn(`[wcode] ${packageName} is unavailable; skipping node-pty prebuild patch`);
      continue;
    }
    const sourcePrebuildRoot = resolve(dirname(packageJsonPath), "prebuilds");
    const sourceStat = await stat(sourcePrebuildRoot).catch(() => null);
    if (!sourceStat?.isDirectory()) {
      continue;
    }
    for (const platformKey of await readdir(sourcePrebuildRoot)) {
      const targetPrebuildDir = resolve(nodePtyPrebuildRoot, platformKey);
      // Bug 原因：平台包是 1.2.0-beta.10（resize 要 5 个参数），旧逻辑整目录 force 覆盖，
      // 把官方 node-pty 自带的同版本 darwin native 换掉，官方 JS 只传 3 个参数，macOS 终端
      // resize 必然失败。官方包已自带的平台 prebuild 与其 JS 同版本，不能被覆盖；
      // 平台包只补官方包缺失的平台。
      if (await pathExists(targetPrebuildDir)) {
        continue;
      }
      await cp(resolve(sourcePrebuildRoot, platformKey), targetPrebuildDir, {
        dereference: true,
        recursive: true,
      });
    }
  }

  for (const helper of [
    resolve(nodePtyPrebuildRoot, "darwin-arm64", "spawn-helper"),
    resolve(nodePtyPrebuildRoot, "darwin-x64", "spawn-helper"),
  ]) {
    if (await pathExists(helper)) {
      await chmod(helper, 0o755);
    }
  }
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
