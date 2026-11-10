import type { TaskWorkload } from "@may-agent/sdk";

export function workloadObservation(): TaskWorkload {
  return {
    version: 1, observedAt: "2026-11-09T00:00:00.000Z",
    scope: { appId: "sample", agent: "worker" },
    coverage: { limit: 2, scanned: 2, matched: 1, truncated: true, nextCursor: "opaque-page" },
    counts: { running: 1, runnable: 0, waiting: 0, attention: 0, idle: 0,
      paused: 0, cooldown: 0, unknown: 0, pendingInputTasks: 0 },
    examples: { blockers: [], dispositionCandidates: [], truncated: false },
    limits: { app: { backgroundMaxConcurrent: 3, interactiveAdditional: 1 },
      host: { available: false }, agent: { available: false }, root: { available: false } },
    queueWait: { available: false }, resourceHealth: { available: false },
  };
}
