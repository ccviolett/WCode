import {
  WCODE_AGENT_PROVIDER,
  WCODE_AGENT_PROVIDER_LABEL,
  type WCodeProvider,
} from "@wcode/shared";

export const WCODE_AGENT_PROVIDERS: WCodeProvider[] = [WCODE_AGENT_PROVIDER];

export const WCODE_AGENT_PROVIDER_LABELS: Record<WCodeProvider, string> = {
  glm: WCODE_AGENT_PROVIDER_LABEL,
};

export function supportsWCodeSessionFork(provider: WCodeProvider): boolean {
  void provider;
  // 功能开关：fork 入口恢复对所有 WCode provider 开放；实际可操作性仍由 task 状态、
  // assistant 目标和运行中保护 guard 控制，避免把 active/failed 分支暴露为可 fork。
  return true;
}

export function shouldHideWCodeSessionForkAction(provider: WCodeProvider): boolean {
  return !supportsWCodeSessionFork(provider);
}
