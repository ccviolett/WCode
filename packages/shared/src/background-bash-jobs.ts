import {
  collectVisibleWCodeBackgroundTaskControlItems,
  getWCodeBackgroundTaskControlItemElapsedMs,
  isActiveWCodeBackgroundTaskControlItem,
  parseWCodeBackgroundTaskControlItems,
  type WCodeBackgroundTaskControlItem,
  type WCodeBackgroundTaskControlStatus,
} from "./background-task-controls.js";

export type WCodeBackgroundBashJobStatus = WCodeBackgroundTaskControlStatus;
export type WCodeBackgroundBashJob = WCodeBackgroundTaskControlItem & {
  taskKind: "bash";
};

export function parseWCodeBackgroundBashJobs(value: unknown): WCodeBackgroundBashJob[] {
  return parseWCodeBackgroundTaskControlItems(value).filter(isBackgroundBashJob);
}

export function isActiveWCodeBackgroundBashJob(job: WCodeBackgroundBashJob): boolean {
  return isActiveWCodeBackgroundTaskControlItem(job);
}

export function getWCodeBackgroundBashJobElapsedMs(
  job: WCodeBackgroundBashJob,
  now = Date.now(),
): number {
  return getWCodeBackgroundTaskControlItemElapsedMs(job, now);
}

export function collectVisibleWCodeBackgroundBashJobs(
  jobs: readonly WCodeBackgroundBashJob[],
  now = Date.now(),
  thresholdMs = 30_000,
): Array<WCodeBackgroundBashJob & { elapsedMs: number }> {
  return collectVisibleWCodeBackgroundTaskControlItems(jobs, now, thresholdMs) as Array<
    WCodeBackgroundBashJob & { elapsedMs: number }
  >;
}

function isBackgroundBashJob(job: WCodeBackgroundTaskControlItem): job is WCodeBackgroundBashJob {
  return job.taskKind === "bash";
}
