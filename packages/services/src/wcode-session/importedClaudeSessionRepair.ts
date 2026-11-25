import type { WCodeSessionStateSnapshot } from "@wcode/shared";
import { createServiceLogger } from "#src/logger/serviceLogger.js";
import { repairImportedClaudeSessionSnapshot } from "#src/session/claude-native/importedClaudeHistoryRepair.js";
import type { IWCodeAgentService } from "#src/wcode-agent/wcodeAgent.js";
import type {
  WCodeSessionReadParams,
  WCodeSessionResumeParams,
} from "#src/wcode-session/wcodeSession.js";

const logger = createServiceLogger("wcode-session-service");

export async function repairEmptyImportedClaudeSessionSnapshot(params: {
  agentService: IWCodeAgentService;
  snapshot: WCodeSessionStateSnapshot;
  target: WCodeSessionResumeParams | WCodeSessionReadParams;
}): Promise<WCodeSessionStateSnapshot> {
  const repaired = await repairImportedClaudeSessionSnapshot({
    snapshot: params.snapshot,
    target: {
      workspacePath: params.target.workspacePath,
      workspaceIdentity: params.target.workspaceIdentity,
      taskId: params.target.sessionId,
      ...("mcpServers" in params.target && params.target.mcpServers
        ? { mcpServers: params.target.mcpServers }
        : {}),
    },
    createSession: (input) => params.agentService.createSession(input),
    onRepair: (history) => {
      logger.warn(
        undefined,
        `[wcode-session-service] Claude 导入 session 历史异常，按 ${history.source} 回填 taskId=${params.target.sessionId}`,
      );
    },
  });
  return repaired ?? params.snapshot;
}
