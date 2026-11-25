const WCODE_PROCESS_PREFIX = "wcode";
const MAX_PROCESS_NAME_SEGMENT_LENGTH = 24;

function sanitizeProcessNameSegment(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, MAX_PROCESS_NAME_SEGMENT_LENGTH);
}

function joinWCodeProcessName(...segments: Array<string | null | undefined>): string {
  const sanitizedSegments = segments
    .map((segment) => sanitizeProcessNameSegment(segment))
    .filter((segment): segment is string => Boolean(segment));
  return [WCODE_PROCESS_PREFIX, ...sanitizedSegments].join("-");
}

function pickWorkspaceTag(workspacePath: string | null | undefined): string | undefined {
  const trimmedPath = workspacePath?.trim();
  if (!trimmedPath) {
    return undefined;
  }

  const parts = trimmedPath.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? trimmedPath;
}

export function formatWCodeMainProcessName(): string {
  return joinWCodeProcessName("main");
}

export function formatWCodeGpuProcessName(): string {
  return joinWCodeProcessName("gpu");
}

export function formatWCodeHostProcessName(label?: string): string {
  return joinWCodeProcessName("host", label);
}

export function formatWCodeRendererProcessName(windowTitle?: string): string {
  const normalizedTitle = windowTitle?.trim();
  if (!normalizedTitle || normalizedTitle === "WCode") {
    return joinWCodeProcessName("renderer", "main");
  }

  if (normalizedTitle === "Resource Manager") {
    return joinWCodeProcessName("renderer", "resource-manager");
  }

  const remoteWindowPrefix = "WCode - ";
  if (normalizedTitle.startsWith(remoteWindowPrefix)) {
    return joinWCodeProcessName(
      "renderer",
      "remote",
      normalizedTitle.slice(remoteWindowPrefix.length),
    );
  }

  return joinWCodeProcessName("renderer", normalizedTitle);
}

export function formatWCodeAgentProcessName(provider: string, workspacePath?: string): string {
  return joinWCodeProcessName("agent", provider, pickWorkspaceTag(workspacePath));
}

export function formatWCodeUtilityProcessName(name?: string, type = "utility"): string {
  return joinWCodeProcessName(type, name);
}
