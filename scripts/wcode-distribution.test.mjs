import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { test } from "node:test";
import {
  patchNodePtyPrebuilds,
  runtimePackageNames,
  stageBundledSkills,
} from "./wcode-distribution/assets.mjs";
import { installScriptSource } from "./wcode-distribution/installer.mjs";

const exec = promisify(execFile);
const runnerSource = new URL("./wcode-distribution/runner.mjs", import.meta.url);

async function fixture(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "wcode-distribution-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, "wcode");
  for (const name of ["bin", "agent", "web", "server"]) {
    await mkdir(join(root, name), { recursive: true });
  }
  await cp(runnerSource, join(root, "bin/wcode.mjs"));
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module", version: "1.2.3" }));
  await writeFile(
    join(root, "agent/wcode.cjs"),
    `
process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), entry: process.argv[1], cwd: process.cwd() }));
process.exitCode = Number(process.env.FIXTURE_EXIT_CODE || 0);
`,
  );
  await writeFile(
    join(root, "server/entry-http.js"),
    `
import { writeFile } from 'node:fs/promises';
await writeFile(process.env.FIXTURE_WEB_RESULT, JSON.stringify({
  cwd: process.cwd(), port: process.env.PORT, host: process.env.WCODE_SERVER_HOST,
  workspace: process.env.WCODE_SERVER_WORKSPACE, staticRoot: process.env.WCODE_WEB_STATIC_ROOT,
  command: process.env.WCODE_AGENT_SERVER_COMMAND, args: JSON.parse(process.env.WCODE_AGENT_SERVER_ARGS_JSON),
  token: process.env.WCODE_SERVER_AUTH_TOKEN,
}));
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);
`,
  );
  return { directory, root, runner: join(root, "bin/wcode.mjs") };
}

test("default launch and CLI arguments reuse the Agent entry without starting Web", async (t) => {
  const { runner, root, directory } = await fixture(t);
  for (const args of [[], ["tui"], ["--prompt", "--web"], ["app-server", "--stdio"]]) {
    const result = await exec(process.execPath, [runner, ...args], { cwd: directory });
    assert.deepEqual(JSON.parse(result.stdout), {
      argv: args,
      entry: join(root, "agent/wcode.cjs"),
      cwd: directory,
    });
  }
  await assert.rejects(
    exec(process.execPath, [runner], { env: { ...process.env, FIXTURE_EXIT_CODE: "17" } }),
    (error) => error.code === 17,
  );
});

test("help exposes Web mode and preserves CLI help; version uses the distribution", async (t) => {
  const { runner } = await fixture(t);
  assert.equal((await exec(process.execPath, [runner, "--version"])).stdout.trim(), "1.2.3");
  const help = (await exec(process.execPath, [runner, "--help"])).stdout;
  assert.match(help, /wcode --web/);
  assert.match(help, /"argv":\["--help"\]/);
  const webHelp = (await exec(process.execPath, [runner, "--web", "--help"])).stdout;
  assert.match(webHelp, /--workspace/);
  assert.doesNotMatch(webHelp, /"argv"/);
  await assert.rejects(exec(process.execPath, [runner, "--web", "--unknown"]), /Unknown option/);
  await assert.rejects(
    exec(process.execPath, [runner, "--web", "--port", "NaN"]),
    /--port must be an integer/,
  );
});

test("Web startup errors preserve a failing exit code", async (t) => {
  const { runner, directory, root } = await fixture(t);
  await assert.rejects(
    exec(process.execPath, [
      runner,
      "--web",
      "--workspace",
      join(directory, "missing"),
      "--no-open",
    ]),
    /Unable to start Web server/,
  );
  await rm(join(root, "server/entry-http.js"));
  await assert.rejects(
    exec(process.execPath, [runner, "--web", "--no-open"]),
    /Missing runtime file/,
  );
});

test("Web mode passes its runtime configuration and terminates its child on shutdown", async (t) => {
  const { directory, runner, root } = await fixture(t);
  const resultPath = join(directory, "web-result.json");
  const child = spawn(
    process.execPath,
    [
      runner,
      "--web",
      "--workspace",
      directory,
      "--host",
      "127.0.0.1",
      "--port",
      "3041",
      "--no-open",
      "--no-token",
    ],
    {
      env: {
        ...process.env,
        FIXTURE_WEB_RESULT: resultPath,
        WCODE_SERVER_AUTH_TOKEN: "stale-token",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let result;
  for (let attempt = 0; attempt < 100; attempt++) {
    result = await readFile(resultPath, "utf8")
      .then(JSON.parse)
      .catch(() => undefined);
    if (result) break;
    await setTimeout(20);
  }
  assert.deepEqual(result, {
    cwd: directory,
    port: "3041",
    host: "127.0.0.1",
    workspace: directory,
    staticRoot: join(root, "web"),
    command: process.execPath,
    args: [join(root, "agent/wcode.cjs"), "app-server", "--stdio"],
    token: "",
  });
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  assert.deepEqual(await exited, [0, null]);
});

test("installer creates wcode and the installed command defaults to CLI", async (t) => {
  const { directory, root } = await fixture(t);
  const downloads = join(directory, "downloads");
  const releaseDir = join(downloads, "releases/1.2.3");
  await mkdir(releaseDir, { recursive: true });
  await exec("tar", ["-czf", join(releaseDir, "wcode-1.2.3.tar.gz"), "-C", directory, "wcode"]);
  await writeFile(
    join(downloads, "latest.json"),
    JSON.stringify({ version: "1.2.3", tarball: "wcode-1.2.3.tar.gz" }),
  );
  const installer = join(directory, "install.sh");
  await writeFile(installer, installScriptSource(`file://${downloads}/`));
  const installRoot = join(directory, "installed");
  const bin = join(directory, "bin");
  await exec("sh", [installer], {
    env: {
      ...process.env,
      WCODE_DIST_BASE_URL: `file://${downloads}/`,
      WCODE_DIST_HOME: installRoot,
      WCODE_DIST_BIN_DIR: bin,
    },
  });
  await rm(root, { recursive: true });
  const result = await exec(join(bin, "wcode"), [], { cwd: directory });
  assert.deepEqual(JSON.parse(result.stdout).argv, []);
  const webHelp = await exec(join(bin, "wcode"), ["--web", "--help"]);
  assert.match(webHelp.stdout, /wcode --web/);
});

test("node-pty prebuild patch keeps the official native that matches the official JS", async (t) => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "wcode-distribution-pty-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const prebuilds = join(directory, "node_modules/node-pty/prebuilds");
  await mkdir(join(prebuilds, "darwin-arm64"), { recursive: true });
  await writeFile(join(prebuilds, "darwin-arm64/pty.node"), "official-1.1.0");
  await patchNodePtyPrebuilds(directory);
  // Bug 回归：旧补丁用平台包 1.2.0-beta.10 的 darwin native 覆盖官方 1.1.0 native，
  // 官方 JS 只传 3 个 resize 参数，新 native 要 5 个，macOS 终端 resize 必然失败。
  assert.equal(await readFile(join(prebuilds, "darwin-arm64/pty.node"), "utf8"), "official-1.1.0");
  // 官方包缺失的平台仍由平台包补齐。
  assert.ok((await readFile(join(prebuilds, "linux-x64/pty.node"))).length > 0);
});

test("stageBundledSkills stages dynamic-workflows skill pack and rejects missing required assets", async (t) => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "wcode-distribution-skills-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packageRoot = join(directory, "wcode");
  await mkdir(packageRoot, { recursive: true });
  await stageBundledSkills(packageRoot);
  for (const relativePath of [
    "README.md",
    "skills/dynamic-workflows/SKILL.md",
    "skills/dynamic-workflows/patterns.md",
    "skills/dynamic-workflows/examples.md",
  ]) {
    const content = await readFile(
      join(packageRoot, "agent/packages/bundled-skills", relativePath),
      "utf8",
    );
    assert.ok(content.length > 0, `expected non-empty staged asset ${relativePath}`);
  }

  const brokenCliRoot = join(directory, "broken-cli");
  await mkdir(join(brokenCliRoot, "packages/bundled-skills/skills/dynamic-workflows"), {
    recursive: true,
  });
  await writeFile(
    join(brokenCliRoot, "packages/bundled-skills/skills/dynamic-workflows/SKILL.md"),
    "skill",
  );
  await writeFile(
    join(brokenCliRoot, "packages/bundled-skills/skills/dynamic-workflows/patterns.md"),
    "patterns",
  );
  await assert.rejects(
    stageBundledSkills(join(directory, "broken-package"), { cliRoot: brokenCliRoot }),
    /Missing bundled skill pack required asset/,
  );
});

test("Web mode honors WCODE_SERVER_AUTH_TOKEN from env without echoing it to stdout", async (t) => {
  const { directory, runner } = await fixture(t);
  const resultPath = join(directory, "web-env-token.json");
  const secretToken = "env-secret-token-for-systemd-docker";
  const child = spawn(
    process.execPath,
    [runner, "--web", "--workspace", directory, "--host", "0.0.0.0", "--port", "3042", "--no-open"],
    {
      env: {
        ...process.env,
        FIXTURE_WEB_RESULT: resultPath,
        WCODE_SERVER_AUTH_TOKEN: secretToken,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let result;
  for (let attempt = 0; attempt < 100; attempt++) {
    result = await readFile(resultPath, "utf8")
      .then(JSON.parse)
      .catch(() => undefined);
    if (result) break;
    await setTimeout(20);
  }
  assert.equal(result.token, secretToken);
  assert.doesNotMatch(stdout, new RegExp(secretToken));
  assert.match(stdout, /protected by WCODE_SERVER_AUTH_TOKEN/);
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  assert.deepEqual(await exited, [0, null]);
});

test("installer supports flat GitHub Releases layout and enforces sha256 verification", async (t) => {
  const { directory } = await fixture(t);
  const downloads = join(directory, "gh-release");
  await mkdir(downloads, { recursive: true });
  const archive = join(downloads, "wcode-1.2.3.tar.gz");
  await exec("tar", ["-czf", archive, "-C", directory, "wcode"]);
  const sha256 = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await writeFile(
    join(downloads, "latest.json"),
    JSON.stringify({
      version: "1.2.3",
      tarball: "wcode-1.2.3.tar.gz",
      tarballPath: "wcode-1.2.3.tar.gz",
      sha256,
    }),
  );
  const installer = join(directory, "install.sh");
  await writeFile(installer, installScriptSource(`file://${downloads}/`));
  const installRoot = join(directory, "installed");
  const bin = join(directory, "bin");
  await exec("sh", [installer], {
    env: {
      ...process.env,
      WCODE_DIST_HOME: installRoot,
      WCODE_DIST_BIN_DIR: bin,
    },
  });
  const versionOutput = (await exec(join(bin, "wcode"), ["--version"])).stdout.trim();
  assert.equal(versionOutput, "1.2.3");

  // 篡改摘要时拒绝安装，且不破坏已有 current 软链。
  await writeFile(
    join(downloads, "latest.json"),
    JSON.stringify({
      version: "1.2.4",
      tarball: "wcode-1.2.3.tar.gz",
      tarballPath: "wcode-1.2.3.tar.gz",
      sha256: "0".repeat(64),
    }),
  );
  await assert.rejects(
    exec("sh", [installer], {
      env: {
        ...process.env,
        WCODE_DIST_HOME: installRoot,
        WCODE_DIST_BIN_DIR: bin,
      },
    }),
    /checksum mismatch/,
  );
  assert.equal((await exec(join(bin, "wcode"), ["--version"])).stdout.trim(), "1.2.3");
});

test("installer downloads isolated private Node 24 when host PATH lacks Node >= 24", async (t) => {
  const { directory } = await fixture(t);
  const downloads = join(directory, "downloads");
  const nodeDist = join(directory, "node-dist");
  const platformKey = `${process.platform === "darwin" ? "darwin" : "linux"}-${process.arch}`;
  const nodeVersion = "24.14.0";
  const nodeSlug = `node-v${nodeVersion}-${platformKey}`;
  const fakeNodeDir = join(directory, "fake-node-stage", nodeSlug, "bin");
  await mkdir(fakeNodeDir, { recursive: true });
  await mkdir(join(nodeDist, `v${nodeVersion}`), { recursive: true });
  await mkdir(downloads, { recursive: true });

  // 用指向当前 Node 24+ 可执行文件的轻量垫片构造隔离运行时包，验证完整下载、解包与执行链路。
  const shim = join(fakeNodeDir, "node");
  await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "$@"\n`);
  await chmod(shim, 0o755);
  await exec("tar", [
    "-czf",
    join(nodeDist, `v${nodeVersion}`, `${nodeSlug}.tar.gz`),
    "-C",
    join(directory, "fake-node-stage"),
    nodeSlug,
  ]);

  const archive = join(downloads, "wcode-1.2.3.tar.gz");
  await exec("tar", ["-czf", archive, "-C", directory, "wcode"]);
  const sha256 = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await writeFile(
    join(downloads, "latest.json"),
    JSON.stringify({
      version: "1.2.3",
      tarball: "wcode-1.2.3.tar.gz",
      tarballPath: "wcode-1.2.3.tar.gz",
      sha256,
    }),
  );

  // 构造仅含基础系统工具且不含 node 的最小 PATH，强制触发私有 Node 兜底分支。
  // Bug 原因：Linux GNU tar -xzf 需要从 PATH 调用外部 gzip，而 macOS BSD tar 内置 libz；
  // 此前遗漏 gzip 导致 ubuntu-latest CI 在解包隔离 Node 时报 tar (child): gzip: Cannot exec。
  const cleanPathDir = join(directory, "clean-path");
  await mkdir(cleanPathDir, { recursive: true });
  for (const tool of [
    "curl",
    "tar",
    "gzip",
    "uname",
    "mktemp",
    "mkdir",
    "rm",
    "mv",
    "ln",
    "chmod",
    "cat",
  ]) {
    const resolved = (await exec("sh", ["-c", `command -v ${tool}`])).stdout.trim();
    await exec("ln", ["-sf", resolved, join(cleanPathDir, tool)]);
  }

  const installer = join(directory, "install.sh");
  await writeFile(installer, installScriptSource(`file://${downloads}/`));
  const installRoot = join(directory, "installed");
  const bin = join(directory, "bin");
  await exec("/bin/sh", [installer], {
    env: {
      HOME: directory,
      PATH: cleanPathDir,
      WCODE_DIST_HOME: installRoot,
      WCODE_DIST_BIN_DIR: bin,
      WCODE_NODE_DIST_URL: `file://${nodeDist}/`,
      WCODE_NODE_VERSION: nodeVersion,
    },
  });

  // 即使运行期 PATH 仍无 node，已安装的 wcode 也应自动调用私有 Node 运行时启动。
  const versionOutput = (
    await exec(join(bin, "wcode"), ["--version"], {
      env: { HOME: directory, PATH: cleanPathDir },
    })
  ).stdout.trim();
  assert.equal(versionOutput, "1.2.3");
});

test("runtimePackageNames covers every external dependency of @wcode/server HTTP bundle", async () => {
  // Bug 回归：v4.0.0 将 @napi-rs/keyring 加入 server external，但发行包拷贝列表遗漏，
  // 导致脱离仓库运行 wcode --web 启动即报 ERR_MODULE_NOT_FOUND。
  const tsupConfig = await readFile(
    new URL("../packages/server/tsup.config.ts", import.meta.url),
    "utf8",
  );
  const blockMatch = tsupConfig.match(
    /export const SERVER_HTTP_EXTERNAL_DEPENDENCIES\s*=\s*\[([\s\S]*?)\];/,
  );
  assert.ok(
    blockMatch,
    "SERVER_HTTP_EXTERNAL_DEPENDENCIES not found in packages/server/tsup.config.ts",
  );
  const codeWithoutComments = blockMatch[1].replace(/\/\/[^\n]*/g, "");
  const externals = [...new Set([...codeWithoutComments.matchAll(/"([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(
    externals.includes("@napi-rs/keyring"),
    "expected @napi-rs/keyring in server externals",
  );
  const missing = externals.filter((pkg) => !runtimePackageNames.includes(pkg));
  assert.deepEqual(
    missing,
    [],
    `Missing server runtime packages in assets.mjs: ${missing.join(", ")}`,
  );
});

test("docker entrypoint initializes 0600 credential-secret once and preserves existing state", async (t) => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "wcode-docker-entry-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const entrypoint = new URL("../deploy/docker/entrypoint.sh", import.meta.url).pathname;
  const stubRunner = join(directory, "stub-runner.mjs");
  await writeFile(stubRunner, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");

  const dataDir = join(directory, "data-fresh");
  await exec("sh", [entrypoint], {
    env: {
      ...process.env,
      WCODE_DATA_BASE_DIR: dataDir,
      WCODE_RUNNER_BIN: stubRunner,
      WCODE_CREDENTIAL_SECRET: "",
      WCODE_CREDENTIAL_SECRET_FILE: "",
    },
  });
  const secretPath = join(dataDir, ".wcode/v2/credential-secret");
  const firstSecret = await readFile(secretPath);
  assert.equal(firstSecret.length, 32);
  assert.equal((await stat(secretPath)).mode & 0o777, 0o600);

  // 二次启动必须复用既有密钥，绝不覆盖已有加密凭据的主密钥。
  await exec("sh", [entrypoint], {
    env: {
      ...process.env,
      WCODE_DATA_BASE_DIR: dataDir,
      WCODE_RUNNER_BIN: stubRunner,
      WCODE_CREDENTIAL_SECRET: "",
      WCODE_CREDENTIAL_SECRET_FILE: "",
    },
  });
  assert.deepEqual(await readFile(secretPath), firstSecret);

  // 显式指定 WCODE_CREDENTIAL_SECRET_FILE 时不写入默认 credential-secret。
  const dataExplicit = join(directory, "data-explicit");
  await exec("sh", [entrypoint], {
    env: {
      ...process.env,
      WCODE_DATA_BASE_DIR: dataExplicit,
      WCODE_RUNNER_BIN: stubRunner,
      WCODE_CREDENTIAL_SECRET: "",
      WCODE_CREDENTIAL_SECRET_FILE: secretPath,
    },
  });
  await assert.rejects(stat(join(dataExplicit, ".wcode/v2/credential-secret")));
});
