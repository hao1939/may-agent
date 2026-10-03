import type { AppDefinition } from "@may-agent/sdk";

// Explicit migration declarations, not an age-based automatic retirement rule.
// Normal App activation preserves history and stops selecting obsolete sources.
export const retiredLegacyMetrics: NonNullable<AppDefinition["metrics"]> = [
  ...[
    "agent.config-invalid-count-1h",
    "agent.heartbeat-dark-count-2h",
    "capability.status-reality-mismatch-count",
    "capability.zombie-session-count",
    "escalation.pending-count",
    "guard.blocked-count-15m",
    "guard.repeat-trigger-count-24h",
    "guard.triggered-count-24h",
    "guard.warned-count-24h",
    "handler.completed-count",
    "handler.failed-count",
    "handler.fires-per-hour",
    "handler.heartbeat-coverage",
    "handler.p95-duration",
    "handler.success-rate",
    "infra.bus.event-count-1h",
    "infra.messages.delivery-rate",
    "infra.persist.db-size-mb",
    "infra.sessions.active-count",
    "message.delivery-failed-count-1h",
    "metric.structurally-pinned-count",
    "project.active-count",
    "project.blocked-count",
    "project.blocked-over-6h",
    "project.stale-active-count",
    "runtime.daemon-heartbeat-stale",
    "runtime.project-app-schedule-orphan-count-1h",
    "runtime.stale-running-session-count",
    "session.empty-assistant-stop-count-1h",
    "session.error-rate-6h",
    "session.first-turn-error-count-1h",
    "session.planner-timeout-rate-6h",
    "session.provider-error-count-1h",
  ].map((id) => ({
    id,
    owner: "may",
    status: "retired" as const,
    description:
      "Paused platform catalog: its legacy handler is not an active collector. Current Task outcomes, input recovery and delivery metrics own operational review.",
  })),
  ...[
    "gym.approved-proposal-receipts",
    "gym.completed-codex-learning-receipts",
    "gym.completed-evaluation-intake-receipts",
    "gym.evaluation-intake-classification-latency-ms",
    "gym.model-runtime-ms",
    "gym.model-trials",
    "gym.prevented-regression-comparison-receipts",
    "gym.proposals-accepted",
    "gym.regressions-prevented",
    "gym.time-to-classification-ms",
    "gym.valid-run-rate",
  ].map((id) => ({
    id,
    owner: "may",
    status: "retired" as const,
    description:
      "Retired Gym workflow or unimplemented receipt replacement; current Gym comparisons do not produce this metric.",
  })),
  ...[
    "session.finish-blocked-uncommitted-count-24h",
    "session.finish-blocked-unresolved-count-24h",
  ].map((id) => ({
    id,
    owner: "may",
    status: "retired" as const,
    description:
      "Legacy session-review checks; current Task-attempt and input-recovery evidence own review.",
  })),
  ...["may-agent.migration.legacy-app-count"].map((id) => ({
    id,
    owner: "may",
    status: "retired" as const,
    description:
      "One-time platform migration; no current collection or ongoing operational purpose.",
  })),
];
