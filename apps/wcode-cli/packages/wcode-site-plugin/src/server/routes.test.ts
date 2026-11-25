import { describe, expect, it } from "vitest";
import { resourcePath } from "./routes.ts";

const SITE = "1978123456789012480";
const DEP = "1978123456789012481";

describe("resourcePath", () => {
  it.each([
    ["wcode-site://usage", "/api/v1/sites/usage"],
    ["wcode-site://plans", "/api/v1/sites/plans"],
    ["wcode-site://sites", "/api/v1/sites"],
    ["wcode-site://sites?cursor=", "/api/v1/sites"],
    [
      "wcode-site://sites?cursor=a%2Fb&limit=20",
      "/api/v1/sites?cursor=a%2Fb&limit=20",
    ],
    [`wcode-site://sites/${SITE}`, `/api/v1/sites/${SITE}`],
    [
      `wcode-site://sites/${SITE}/deployments?cursor=x`,
      `/api/v1/sites/${SITE}/deployments?cursor=x`,
    ],
    [
      `wcode-site://sites/${SITE}/deployments/${DEP}`,
      `/api/v1/sites/${SITE}/deployments/${DEP}`,
    ],
    [`wcode-site://sites/${SITE}/cover`, `/api/v1/sites/${SITE}/cover`],
    [`wcode-site://sites/${SITE}/analytics`, `/api/v1/sites/${SITE}/analytics`],
    [
      `wcode-site://sites/${SITE}/analytics?range=30d`,
      `/api/v1/sites/${SITE}/analytics?range=30d`,
    ],
    [
      `wcode-site://sites/analytics/pv24h?siteIds=${SITE},${DEP}`,
      `/api/v1/sites/analytics/pv24h?siteIds=${SITE}%2C${DEP}`,
    ],
    [
      `wcode-site://sites/${SITE}/deployments/${DEP}/logs?offset=12`,
      `/api/v1/sites/${SITE}/deployments/${DEP}/logs?offset=12`,
    ],
  ])("maps %s", (uri, path) => {
    expect(resourcePath(uri)).toBe(path);
  });

  it.each([
    "wcode-site://other",
    "https://sites/1",
    "wcode-site://usage?cursor=1",
    "wcode-site://plans?limit=1",
    "wcode-site://plans/free",
    "wcode-site://sites/abc",
    "wcode-site://sites/0123",
    "wcode-site://sites/1/deployments/2/logs/extra",
    "wcode-site://sites/1/cover/2",
    "wcode-site://sites/1/cover?offset=1",
    "wcode-site://sites/1/settings",
    "wcode-site://sites/1/deployments/2/logs?offset=-1",
    "wcode-site://sites?limit=1e3",
    "wcode-site://sites?cursor=a&cursor=b",
    "wcode-site://sites/1/deployments/2?offset=1",
    "wcode-site://user@sites",
    "wcode-site://sites/..%2Fusage",
    "wcode-site://sites/1/analytics?range=1y",
    "wcode-site://sites/1/analytics?offset=1",
    "wcode-site://sites/1/analytics/pages",
    "wcode-site://sites/analytics",
    "wcode-site://sites/analytics/pv24h?siteIds=1,abc",
    `wcode-site://sites/analytics/pv24h?siteIds=${Array(21).fill("1").join(",")}`,
    "wcode-site://sites/analytics/pv24h?range=24h",
    "not a uri",
  ])("rejects %s", (uri) => {
    expect(resourcePath(uri)).toBeUndefined();
  });
});
