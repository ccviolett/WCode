export const pluginDiscoveryModule = {
  id: "plugin-discovery",
  requires: ["wcode-cli", "shared"],
  provides: ["plugin-discovery"],
  publicEntrypoints: ["index.ts", "contract.ts"],
} as const;
