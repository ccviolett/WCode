# Installing wcode-cua on Linux

> DEPRECATED. The Python MCP server that lived in this repo is **removed**. The
> canonical CUA MCP tool is now the TypeScript package **@wcode/wcode-cua**
> (npm). This document described the old
> `uvx --from wcode-cua[linux]@<wheel> wcode-cua` install path plus the
> `scripts/wcode-cua-linux` distro-`pyatspi`
> launcher — all of which targeted the removed Python server and no longer apply.

Install the canonical tool from npm:

```bash
npm install @wcode/wcode-cua
# or, without installing:
npx @wcode/wcode-cua
```

Source and the Linux/AT-SPI backend live in the z-code repo:
[git.example.invalid/codegeex/z-code](https://git.example.invalid/codegeex/z-code)
→ package [@wcode/wcode-cua](https://www.npmjs.com/package/@wcode/wcode-cua).

What this repo still hosts (the real-model act-verify harness, the canonical
skill, screenshot-pipeline parity fixtures) is described in the top-level
`README.md`. The earlier Python-server Linux install guide is preserved in the
git history of this repo (see the commit prior to `refactor/deprecate-python`).

Current producer integration is documented in the
[monorepo migration guide](../wcode-cua-monorepo-migration.md).
