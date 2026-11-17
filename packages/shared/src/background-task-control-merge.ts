import type { WCodeBackgroundTaskControlItem } from "./background-task-controls.js";

export function mergeWCodeBackgroundTaskControlItems(
  current: readonly WCodeBackgroundTaskControlItem[],
  updates: readonly WCodeBackgroundTaskControlItem[],
): WCodeBackgroundTaskControlItem[] {
  const jobsById = new Map(current.map((job) => [job.jobId, job] as const));
  for (const job of updates) {
    jobsById.set(job.jobId, job);
  }
  return Array.from(jobsById.values());
}
