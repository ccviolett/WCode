import { describe, expect, it } from "vitest";
import { resolveDefaultEmbeddedSearchBackend } from "../src/app/embedded-search-backend.js";

describe("resolveDefaultEmbeddedSearchBackend", () => {
  it("uses bundled bfs, ugrep, and ripgrep paths by default", () => {
    expect(
      resolveDefaultEmbeddedSearchBackend({
        env: {
          WCODE_BFS_BINARY: "/opt/wcode/tools/bfs/bfs",
          WCODE_RG_BINARY: "/opt/wcode/tools/ripgrep/rg",
          WCODE_UGREP_BINARY: "/opt/wcode/tools/ugrep/ugrep",
        },
      }),
    ).toEqual({
      kind: "native-binaries",
      findCommand: "/opt/wcode/tools/bfs/bfs",
      grepCommand: "/opt/wcode/tools/ugrep/ugrep",
      rgCommand: "/opt/wcode/tools/ripgrep/rg",
    });
  });

  it("falls back to bfs, ugrep, and rg command names when bundled paths are unavailable", () => {
    expect(resolveDefaultEmbeddedSearchBackend({ env: {} })).toEqual({
      kind: "native-binaries",
      findCommand: "bfs",
      grepCommand: "ugrep",
      rgCommand: "rg",
    });
  });

  it("preserves the explicit internal CLI compatibility override", () => {
    expect(
      resolveDefaultEmbeddedSearchBackend({
        env: { WCODE_EMBEDDED_SEARCH_COMMAND: "/tmp/wcode-test" },
      }),
    ).toEqual({
      kind: "internal-cli",
      command: "/tmp/wcode-test",
      args: ["__internal-search"],
    });
  });
});
