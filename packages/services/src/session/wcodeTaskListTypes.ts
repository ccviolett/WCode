import type { WorkspacePurpose, WCodeTaskMeta } from "@wcode/shared";

export type WCodeTaskListKind = "pinned" | "archived" | "timeline" | "active";
export type WCodeTaskListSortBy = "created" | "updated";

export interface WCodeTaskListWorkspaceScope {
  workspacePath: string;
  workspaceIdentity?: string;
  workspacePurpose?: WorkspacePurpose;
}

export interface WCodeTaskListQuery {
  kind: WCodeTaskListKind | "all";
  /** host 由存储 owner 确定全部范围，不接受 UI 已打开工作区作为历史目录。 */
  workspaceScopes: WCodeTaskListWorkspaceScope[] | "host";
  sortBy: WCodeTaskListSortBy;
  search?: string;
  limit?: number;
  /** 只返回这些会话（例如分享管理按来源会话 ID 解析跳转目标）；空数组返回空结果。 */
  taskIds?: readonly string[];
}

export type WCodeTaskListItem = WCodeTaskMeta & {
  searchSnippet?: string;
  searchSnippets?: string[];
};

export interface WCodeTaskListResult {
  items: WCodeTaskListItem[];
  total: number;
  hasMore: boolean;
}

export interface WCodeWorkspaceEventSubscriptionParams {
  workspacePath: string;
  workspaceIdentity?: string;
}
