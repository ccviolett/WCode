#!/usr/bin/env node
/**
 * 确定性上游同步工具：将上游 ZCode 提交翻译为纯净 WCode 基线树并写入 `upstream/wcode-base` 分支，
 * 全程不触碰当前工作区与 HEAD，随后在 `main` 上执行标准 `git merge upstream/wcode-base`。
 *
 * 用法：
 *   node scripts/sync-upstream.mjs --source upstream-zcode/main --branch upstream/wcode-base
 *   node scripts/sync-upstream.mjs --source fec97590 --dry-run --compare f58dd393
 */

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoBrokenExternalContracts,
  isBinaryPath,
  patchConfigFile,
  shouldDropUpstreamPath,
  transformPath,
  transformText,
} from "./sync-upstream/transform.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const opts = {
    branch: "upstream/wcode-base",
    compare: null,
    dryRun: false,
    parent: null,
    source: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--source" && argv[i + 1]) {
      opts.source = argv[++i];
    } else if (arg === "--branch" && argv[i + 1]) {
      opts.branch = argv[++i];
    } else if (arg === "--parent" && argv[i + 1]) {
      opts.parent = argv[++i];
    } else if (arg === "--compare" && argv[i + 1]) {
      opts.compare = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/sync-upstream.mjs --source <git-ref> [--branch upstream/wcode-base] [--parent <commit>] [--dry-run] [--compare <ref>]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.source) {
    throw new Error("Missing required --source <git-ref>");
  }
  return opts;
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
}

function gitTryRevParse(ref) {
  const res = spawnSync("git", ["rev-parse", "--verify", ref], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return res.status === 0 ? res.stdout.trim() : null;
}

function isLikelyBinaryBuffer(buf) {
  const sampleLen = Math.min(buf.length, 8000);
  for (let i = 0; i < sampleLen; i += 1) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function buildUpstreamSnapshotFromTree(treeSha, sourceCommitSha) {
  const raw = git(["ls-tree", "-r", "-z", treeSha]);
  const files = {};
  for (const entry of raw.split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    if (tab < 0) continue;
    const meta = entry.slice(0, tab).split(" ");
    const filePath = entry.slice(tab + 1);
    if (filePath === "scripts/architecture/upstream-snapshot.json") continue;
    const mode = meta[0];
    const sha = meta[2];
    if (mode === "100644" || mode === "100755" || mode === "120000") {
      files[filePath] = `${mode} ${sha}`;
    }
  }
  return `${JSON.stringify(
    {
      version: 1,
      upstreamCommit: sourceCommitSha,
      introduced: [],
      historicalFiles: {},
      files,
    },
    null,
    2,
  )}\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sourceCommit = git(["rev-parse", `${opts.source}^{commit}`]).trim();
  const sourceSubject = git(["show", "-s", "--format=%s", sourceCommit]).trim();
  const gitDir = resolve(repoRoot, git(["rev-parse", "--git-dir"]).trim());

  const workTmp = mkdtempSync(join(tmpdir(), "wcode-sync-upstream-"));
  const extractDir = join(workTmp, "src");
  const outDir = join(workTmp, "out");
  const tmpIndex = join(workTmp, "index");
  mkdirSync(extractDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  try {
    // 1. 仅用 git archive 导出源树，不触碰工作区与索引。
    const archive = spawnSync("git", ["archive", sourceCommit], {
      cwd: repoRoot,
      maxBuffer: 512 * 1024 * 1024,
    });
    if (archive.status !== 0) {
      throw new Error(`git archive failed: ${archive.stderr?.toString()}`);
    }
    const untar = spawnSync("tar", ["-x", "-C", extractDir], {
      input: archive.stdout,
    });
    if (untar.status !== 0) {
      throw new Error(`tar extract failed: ${untar.stderr?.toString()}`);
    }

    // 2. 遍历源树 ls-tree，精确保留文件权限与符号链接。
    const treeEntries = git(["ls-tree", "-r", "-z", sourceCommit]).split("\0").filter(Boolean);

    let keptCount = 0;
    let droppedCount = 0;
    let transformedCount = 0;

    for (const entry of treeEntries) {
      const tab = entry.indexOf("\t");
      const [mode] = entry.slice(0, tab).split(" ");
      const relPath = entry.slice(tab + 1);

      if (shouldDropUpstreamPath(relPath)) {
        droppedCount += 1;
        continue;
      }

      const targetRelPath = transformPath(relPath);
      const srcAbs = join(extractDir, relPath);
      const dstAbs = join(outDir, targetRelPath);
      mkdirSync(dirname(dstAbs), { recursive: true });

      const rawBuf = readFileSync(srcAbs);
      if (isBinaryPath(relPath) || isLikelyBinaryBuffer(rawBuf)) {
        writeFileSync(dstAbs, rawBuf);
      } else {
        const originalText = rawBuf.toString("utf8");
        let nextText = transformText(originalText, targetRelPath);
        nextText = patchConfigFile(nextText, targetRelPath);
        assertNoBrokenExternalContracts(nextText, targetRelPath);
        if (nextText !== originalText || targetRelPath !== relPath) {
          transformedCount += 1;
        }
        writeFileSync(dstAbs, nextText, "utf8");
      }

      if (mode === "100755") {
        chmodSync(dstAbs, 0o755);
      }
      keptCount += 1;
    }

    const indexEnv = { ...process.env, GIT_INDEX_FILE: tmpIndex };

    // 3. 写入第一遍树，并用真实 blob sha 刷新 scripts/architecture/upstream-snapshot.json。
    git(["--git-dir", gitDir, "--work-tree", outDir, "add", "-A"], { env: indexEnv });
    const prelimTree = git(["--git-dir", gitDir, "write-tree"], { env: indexEnv }).trim();
    const snapshotAbs = join(outDir, "scripts/architecture/upstream-snapshot.json");
    mkdirSync(dirname(snapshotAbs), { recursive: true });
    writeFileSync(snapshotAbs, buildUpstreamSnapshotFromTree(prelimTree, sourceCommit), "utf8");

    git(
      [
        "--git-dir",
        gitDir,
        "--work-tree",
        outDir,
        "add",
        "scripts/architecture/upstream-snapshot.json",
      ],
      { env: indexEnv },
    );
    const finalTree = git(["--git-dir", gitDir, "write-tree"], { env: indexEnv }).trim();

    console.log(
      `[sync-upstream] source=${sourceCommit.slice(0, 8)} (${sourceSubject}) kept=${keptCount} dropped=${droppedCount} transformed=${transformedCount} tree=${finalTree.slice(0, 8)}`,
    );

    if (opts.compare) {
      const cmpRef = git(["rev-parse", opts.compare]).trim();
      const shortstat = git(["diff", "--shortstat", cmpRef, finalTree]).trim();
      const names = git(["diff", "--name-status", cmpRef, finalTree]).trim().split("\n");
      console.log(`[sync-upstream] diff vs ${opts.compare}: ${shortstat || "identical"}`);
      console.log(
        `[sync-upstream] first 40 diffs:\n${names
          .slice(0, 40)
          .map((l) => `  ${l}`)
          .join("\n")}`,
      );
    }

    if (opts.dryRun) {
      console.log("[sync-upstream] --dry-run enabled; no branch updated.");
      return;
    }

    const branchRef = `refs/heads/${opts.branch}`;
    const parentSha = opts.parent
      ? git(["rev-parse", `${opts.parent}^{commit}`]).trim()
      : gitTryRevParse(branchRef);

    const commitMessage = [
      `chore(upstream): sync translated ZCode base (${sourceSubject})`,
      "",
      `Upstream-Commit: ${sourceCommit}`,
      `Generator: scripts/sync-upstream.mjs`,
    ].join("\n");

    const commitArgs = ["--git-dir", gitDir, "commit-tree", finalTree];
    if (parentSha) {
      commitArgs.push("-p", parentSha);
    }
    commitArgs.push("-m", commitMessage);
    const newCommit = git(commitArgs).trim();

    git(["update-ref", branchRef, newCommit]);
    console.log(
      `[sync-upstream] updated ${opts.branch} -> ${newCommit.slice(0, 8)} (parent=${parentSha?.slice(0, 8) ?? "root"})`,
    );
  } finally {
    rmSync(workTmp, { recursive: true, force: true });
  }
}

main();
