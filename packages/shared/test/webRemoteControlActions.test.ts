import { describe, expect, it } from "vitest";
import {
  normalizeWebRemoteControlWorkspaceName,
  resolveUnrecognizedWebRemoteControlRequest,
} from "../src/web-remote-relay/index.js";
import {
  parseWebRemoteControlAppPayload,
  webRemoteControlRendererActionRequestSchema,
  webRemoteControlRendererActionResultSchema,
} from "../src/validation.js";

describe("手机置顶/归档/新建项目 payload", () => {
  it.each([
    {
      wcode_type: "task-pin-request",
      requestId: "r1",
      taskId: "t1",
      workspacePath: "/w",
      workspaceIdentity: "remote:ssh:h:/w",
      pinned: true,
    },
    {
      wcode_type: "task-pin-response",
      requestId: "r1",
      taskId: "t1",
      success: true,
      pinned: false,
    },
    { wcode_type: "task-pin-response", requestId: "r1", taskId: "t1", success: false, error: "x" },
    { wcode_type: "task-archive-request", requestId: "r2", taskId: "t1", workspacePath: "/w" },
    {
      wcode_type: "task-archive-request",
      requestId: "r2",
      taskId: "t1",
      workspacePath: "/w",
      archived: false,
    },
    {
      wcode_type: "task-archive-response",
      requestId: "r2",
      taskId: "t1",
      success: true,
      archived: false,
    },
    {
      wcode_type: "task-archive-response",
      requestId: "r2",
      taskId: "t1",
      success: true,
      archived: true,
    },
    { wcode_type: "workspace-create-request", requestId: "r3", name: "demo" },
    {
      wcode_type: "workspace-create-response",
      requestId: "r3",
      success: true,
      workspacePath: "/Users/u/WCodeProject/demo",
      workspaceKey: "/Users/u/WCodeProject/demo",
      projectId: "p1",
      hostId: "local",
    },
    { wcode_type: "workspace-create-response", requestId: "r3", success: false, error: "bad" },
  ])("解析 $wcode_type", (payload) => {
    expect(parseWebRemoteControlAppPayload(payload)).toEqual(payload);
  });

  it("拒绝缺字段或成功应答带错的 payload", () => {
    expect(
      parseWebRemoteControlAppPayload({
        wcode_type: "task-pin-request",
        requestId: "r",
        taskId: "t",
      }),
    ).toBeNull();
    expect(
      parseWebRemoteControlAppPayload({
        wcode_type: "task-archive-response",
        requestId: "r",
        taskId: "t",
        success: true,
      }),
    ).toBeNull();
  });

  it("Renderer IPC 按 kind 区分请求，结果区分成功/失败", () => {
    expect(
      webRemoteControlRendererActionRequestSchema.safeParse({
        requestId: "a",
        kind: "workspace-create",
        name: "demo",
      }).success,
    ).toBe(true);
    expect(
      webRemoteControlRendererActionRequestSchema.safeParse({ requestId: "a", kind: "unknown" })
        .success,
    ).toBe(false);
    expect(
      webRemoteControlRendererActionResultSchema.safeParse({ requestId: "a", success: false })
        .success,
    ).toBe(false);
  });
});

describe("normalizeWebRemoteControlWorkspaceName", () => {
  it("去首尾空白", () => {
    expect(normalizeWebRemoteControlWorkspaceName("  demo ")).toBe("demo");
  });

  it.each(["", "   ", "a/b", "a\\b", ".", ".."])("拒绝非法名称 %j", (name) => {
    expect(() => normalizeWebRemoteControlWorkspaceName(name)).toThrow();
  });
});

describe("resolveUnrecognizedWebRemoteControlRequest", () => {
  it("只对带 requestId 的 -request 类型回错", () => {
    expect(
      resolveUnrecognizedWebRemoteControlRequest({ wcode_type: "future-request", requestId: "r" }),
    ).toEqual({ requestId: "r", wcodeType: "future-request" });
  });

  it.each([
    null,
    "text",
    { wcode_type: "future-response", requestId: "r" },
    { wcode_type: "future-request" },
    { wcode_type: "future-request", requestId: "  " },
    { wcode_type: 1, requestId: "r" },
  ])("忽略 %j", (value) => {
    expect(resolveUnrecognizedWebRemoteControlRequest(value)).toBeNull();
  });
});
