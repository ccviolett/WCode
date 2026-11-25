import type { WCodeSessionStateSnapshot } from "@wcode/shared";
import type {
  WCodeSessionWorkspaceTarget,
  WCodeTaskTarget,
} from "#src/wcode-session/wcodeSession.js";

function getWorkspaceKey(target: WCodeSessionWorkspaceTarget): string {
  return target.workspaceIdentity?.trim() || target.workspacePath;
}

function getSessionScopedKey(target: WCodeTaskTarget): string {
  return `${getWorkspaceKey(target)}\0${target.sessionId}`;
}

export function createWCodeDeferredDraftRegistry() {
  const sessionKeys = new Set<string>();

  return {
    remember(params: WCodeSessionWorkspaceTarget, snapshot: WCodeSessionStateSnapshot): void {
      sessionKeys.add(
        getSessionScopedKey({
          workspacePath: snapshot.session.workspace.workspacePath,
          workspaceIdentity:
            snapshot.session.workspace.workspaceIdentity ?? params.workspaceIdentity,
          sessionId: snapshot.session.sessionId,
        }),
      );
    },

    has(target: WCodeTaskTarget): boolean {
      return sessionKeys.has(getSessionScopedKey(target));
    },

    forget(target: WCodeTaskTarget): void {
      sessionKeys.delete(getSessionScopedKey(target));
    },
  };
}
