/**
 * metrics-snapshot — Measures system health metrics every 5 minutes.
 * See: projects/may-agent.app/docs/2a-design/metrics.md
 *
 * ── Built-in Metric Registry ────────────────────────────────────────────────
 * This handler owns the built-in system health metrics below. On every run it
 * upserts metric rows and refreshes mutable metadata (name/owner/target/etc.)
 * so DB rows cannot silently drift away from the registry constants.
 *
 * Custom metrics can still be measured via metrics.source_query/source_command
 * in the generic section near the end of the handler.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  EventEnvelope,
  HandlerContext,
  HandlerModule,
} from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";
import {
  listConfiguredAgents,
  resolveMetricOwner,
} from "../../../shared/lib/metric-ownership.ts";
import { validateProjectFormat } from "../../../shared/lib/project-health.ts";

const execAsync = promisify(exec);

// v2 metric types:
//   gauge   — point-in-time value, can go up/down (rates, ratios, sizes)
//   counter — monotonically increasing total or explicit event-rate source
//   health  — boolean pass/fail or count-of-failures (build_passing, errors)
//   derived — computed from other metrics (not yet used in built-ins)
//
// alert_op: "<" = alert when current < threshold (too low)
//           ">" = alert when current > threshold (too high)
//
// config: JSON with type-specific alert rules:
//   gauge:   { alert: { mode: "threshold" | "sustained", consecutive?: number } }
//   counter: { alert: { mode: "rate", min_rate?: number, per: "hour"|"day", stall_after_ms?: number } }
//   health:  { alert: { mode: "consecutive_failures", count: number } }

interface MetricDef {
  id: string;
  name: string;
  owner?: string;
  type: "gauge" | "counter" | "health" | "derived";
  target: number;
  threshold: number;
  unit: string;
  alert_op: "<" | ">";
  project?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  config?: Record<string, unknown>;
}

const ALL_METRICS: MetricDef[] = [
  // Handler
  {
    id: "handler.completed-count",
    name: "Handler completions (6h)",
    owner: "may",
    type: "gauge",
    target: 50,
    threshold: 10,
    unit: "count",
    alert_op: "<",
    priority: "P1",
  },
  {
    id: "handler.failed-count",
    name: "Handler failures (6h)",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 150,
    unit: "count",
    alert_op: ">",
    priority: "P2",
  },
  {
    id: "handler.success-rate",
    name: "Handler success rate (6h)",
    owner: "tech-lead",
    type: "gauge",
    target: 0.95,
    threshold: 0.8,
    unit: "ratio",
    alert_op: "<",
    priority: "P1",
    config: { alert: { mode: "sustained", consecutive: 3 } },
  },
  {
    id: "handler.heartbeat-coverage",
    name: "Heartbeat coverage (agents with sessions in 2h)",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "agent.heartbeat-dark-count-2h",
    name: "Scheduled heartbeat agents dark (2h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "agent.config-invalid-count-1h",
    name: "Agent config load errors (1h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "runtime.daemon-heartbeat-stale",
    name: "Daemon heartbeat stale",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "boolean",
    alert_op: ">",
    priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "runtime.project-app-schedule-orphan-count-1h",
    name: "Project-app schedule ticks without follow-up (1h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  // Sessions
  {
    id: "session.error-rate-6h",
    name: "Session error rate (6h)",
    owner: "may",
    type: "gauge",
    target: 0.1,
    threshold: 0.3,
    unit: "ratio",
    alert_op: ">",
    priority: "P1",
  },
  {
    id: "session.planner-timeout-rate-6h",
    name: "Project planner interruption/timeout rate (6h)",
    owner: "may",
    type: "gauge",
    target: 0.05,
    threshold: 0.25,
    unit: "ratio",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "sustained", consecutive: 2 } },
  },
  {
    id: "session.first-turn-error-count-1h",
    name: "First-turn provider errors (1h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 20,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "session.provider-error-count-1h",
    name: "Provider errors at any turn (1h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 25,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "session.empty-assistant-stop-count-1h",
    name: "Empty assistant stops (1h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 2,
    unit: "count",
    alert_op: ">",
    priority: "P2",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "session.failed-triage-rate-3h",
    name: "Failed session triage rate (3h)",
    owner: "evaluator",
    type: "gauge",
    target: 1.0,
    threshold: 0.8,
    unit: "ratio",
    alert_op: "<",
    priority: "P1",
  },
  {
    id: "evaluator.aftermath-coverage-rate-3h",
    name: "Evaluator aftermath liveness (3h)",
    owner: "evaluator",
    type: "gauge",
    target: 0.8,
    threshold: 0.2,
    unit: "ratio",
    alert_op: "<",
    priority: "P3",
  },
  {
    id: "eval.llm-coverage-lag-h",
    name: "LLM evaluation lag (hours since last non-heuristic eval)",
    owner: "evaluator",
    type: "gauge",
    target: 1,
    threshold: 4,
    unit: "hours",
    alert_op: ">",
    priority: "P0",
  },
  {
    id: "eval.llm-evals-24h",
    name: "LLM-evaluated sessions (24h)",
    owner: "evaluator",
    type: "gauge",
    target: 4,
    threshold: 1,
    unit: "count",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "evaluator.low-quality-rate-24h",
    name: "Broad needs-improvement/low-score evaluated sessions (24h, dashboard only)",
    owner: "evaluator",
    type: "gauge",
    target: 0.1,
    threshold: 0.8,
    unit: "ratio",
    alert_op: ">",
    priority: "P3",
  },
  {
    id: "evaluator.substantive-low-quality-rate-24h",
    name: "Substantive evaluator quality failures (24h)",
    owner: "evaluator",
    type: "gauge",
    target: 0.1,
    threshold: 0.3,
    unit: "ratio",
    alert_op: ">",
    priority: "P1",
  },
  {
    id: "evaluator.meaningful-review-rate-24h",
    name: "Evaluator meaningful review rate (24h)",
    owner: "evaluator",
    type: "gauge",
    target: 0.9,
    threshold: 0.7,
    unit: "ratio",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "evaluator.triage-closure-rate-24h",
    name: "Evaluator triage closure rate (24h)",
    owner: "evaluator",
    type: "gauge",
    target: 0.9,
    threshold: 0.7,
    unit: "ratio",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "evaluator.false-good-rate-sample",
    name: "Reviewed good sessions overturned (24h)",
    owner: "evaluator",
    type: "gauge",
    target: 0.05,
    threshold: 0.6,
    unit: "ratio",
    alert_op: ">",
    priority: "P2",
  },
  {
    id: "evaluator.project-finding-delivery-rate-24h",
    name: "Evaluation findings handled by target owner workflows (24h)",
    owner: "evaluator",
    type: "gauge",
    target: 0.8,
    threshold: 0.5,
    unit: "ratio",
    alert_op: "<",
    priority: "P1",
  },
  {
    id: "evaluator.project-feedback-pending-age-h",
    name: "Oldest pending evaluation finding delivery (hours)",
    owner: "evaluator",
    type: "gauge",
    target: 0,
    threshold: 12,
    unit: "hours",
    alert_op: ">",
    priority: "P1",
  },
  {
    id: "runtime.stale-running-session-count",
    name: "Stale running sessions (non-evaluator)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 1,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    description:
      "Running/idle non-evaluator sessions older than stale cutoff (30min). Measures platform-wide session health, not evaluator-specific.",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "scout.knowledge-practice-loaded",
    name: "Scout knowledge practice loaded",
    owner: "scout",
    project: "scout-second-brain-learning",
    type: "health",
    target: 1,
    threshold: 1,
    unit: "boolean",
    alert_op: "<",
    priority: "P2",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "scout.knowledge-preamble-coverage",
    name: "Scout knowledge preamble coverage",
    owner: "scout",
    project: "scout-second-brain-learning",
    type: "gauge",
    target: 0.25,
    threshold: 0.15,
    unit: "ratio",
    alert_op: "<",
    priority: "P3",
  },
  {
    id: "scout.sourced-artifacts-24h",
    name: "Scout sourced artifacts (24h)",
    owner: "scout",
    project: "scout-second-brain-learning",
    type: "gauge",
    target: 2,
    threshold: 1,
    unit: "count",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "scout.downstream-reference-files-7d",
    name: "Scout downstream reference files (7d)",
    owner: "scout",
    project: "scout-second-brain-learning",
    type: "gauge",
    target: 3,
    threshold: 1,
    unit: "count",
    alert_op: "<",
    priority: "P3",
  },
  {
    id: "handler.p95-duration",
    name: "Handler p95 duration (ms)",
    owner: "tech-lead",
    type: "gauge",
    target: 120000,
    threshold: 600000,
    unit: "ms",
    alert_op: ">",
    priority: "P2",
  },
  {
    id: "handler.fires-per-hour",
    name: "Handler fires per hour",
    owner: "may",
    type: "gauge",
    target: 15,
    threshold: 8,
    unit: "count",
    alert_op: "<",
    priority: "P1",
  },
  {
    id: "guard.triggered-count-24h",
    name: "Guard triggers (24h watch)",
    owner: "may",
    type: "gauge",
    target: 0,
    // Calibration history: 3500→4500 (2026-06-15), 4500→5500 (2026-06-18), 5500→6500 (2026-09-10)
    // Grows ~100/snapshot with normal system activity; P3 watch metric
    // Current=5581 as of 2026-09-10. 99.6% are beforeToolCall finish() guard signals.
    threshold: 6500,
    unit: "count",
    alert_op: ">",
    priority: "P3",
  },
  {
    id: "guard.warned-count-24h",
    name: "Guard warnings (24h watch)",
    owner: "may",
    type: "gauge",
    target: 0,
    // Calibration history: 3500→4500 (2026-06-15), 4500→5500 (2026-06-18), 5500→6500 (2026-09-10)
    // Tracks closely with triggered-count; P3 watch metric
    // Current=5581 as of 2026-09-10. 99.6% are beforeToolCall finish() guard signals.
    threshold: 6500,
    unit: "count",
    alert_op: ">",
    priority: "P3",
  },
  {
    id: "guard.blocked-count-15m",
    name: "Guard blocks (15m)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 15,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "guard.repeat-trigger-count-24h",
    name: "Repeated guard triggers (24h)",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 5,
    unit: "count",
    alert_op: ">",
    priority: "P2",
  },
  // Project
  {
    id: "project.active-count",
    name: "Active push projects",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: "<",
    priority: "P3",
  },
  {
    id: "project.blocked-count",
    name: "Blocked projects",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 4,
    unit: "count",
    alert_op: ">",
    priority: "P2",
  },
  {
    id: "project.stale-active-count",
    name: "Stale active projects (no iteration 48h)",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 2,
    unit: "count",
    alert_op: ">",
    priority: "P1",
  },
  {
    id: "project.iterations-24h",
    name: "Active project iterations (24h)",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: "<",
    priority: "P3",
  },
  {
    id: "project.blocked-over-6h",
    name: "Projects blocked >6h",
    owner: "may",
    type: "gauge",
    target: 0,
    threshold: 4,
    unit: "count",
    alert_op: ">",
    priority: "P2",
  },
  {
    id: "project.invalid-format-count",
    name: "Invalid project.md format",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "capability.status-reality-mismatch-count",
    name: "Status/reality mismatches",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 3,
    unit: "count",
    alert_op: ">",
    priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "capability.zombie-session-count",
    name: "Zombie sessions (running >30min)",
    owner: "may",
    project: "v2-spec-coverage-buildout",
    type: "health",
    target: 0,
    threshold: 2,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
  {
    id: "message.delivery-failed-count-1h",
    name: "Message delivery failures (1h)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "escalation.pending-count",
    name: "Pending escalations",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 3,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "sustained", consecutive: 2 } },
    // Resolution/dismissal and resume are live. Pending escalation growth is
    // actionable lifecycle debt, not expected accumulation.
  },
  // v2 infra metrics (I1-I4)
  {
    id: "infra.bus.event-count-1h",
    name: "Event bus events (1h)",
    owner: "may",
    project: "v2-spec-coverage-buildout",
    type: "gauge",
    target: 10,
    threshold: 0,
    unit: "count",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "infra.bus.subscriber-failed-count-1h",
    name: "Event bus subscriber failures (1h)",
    owner: "may",
    project: "v2-spec-coverage-buildout",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } },
  },
  {
    id: "infra.persist.db-size-mb",
    name: "DB size (MB)",
    owner: "may",
    project: "v2-spec-coverage-buildout",
    type: "gauge",
    target: 1200,
    threshold: 2500,
    unit: "MB",
    alert_op: ">",
    priority: "P2",
  },
  {
    id: "infra.messages.delivery-rate",
    name: "Message delivery success rate",
    owner: "may",
    project: "v2-spec-coverage-buildout",
    type: "gauge",
    target: 1.0,
    threshold: 0.9,
    unit: "ratio",
    alert_op: "<",
    priority: "P2",
  },
  {
    id: "infra.sessions.active-count",
    name: "Active sessions",
    owner: "may",
    project: "v2-spec-coverage-buildout",
    type: "gauge",
    target: 5,
    threshold: 0,
    unit: "count",
    alert_op: "<",
    priority: "P2",
  },
  // Metric health — structurally-pinned detector (KE-938/KE-939/KE-940)
  {
    id: "metric.structurally-pinned-count",
    name: "Structurally pinned metrics (dv=1/7d)",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 0,
    unit: "count",
    alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } },
  },
];

const RETIRED_METRIC_IDS = [
  "evaluator.stale-running-session-count",
  "evaluator.success-candidates-24h",
  "evaluator.success-learnings-24h",
  "evaluator.project-feedback-acceptance-rate-24h",
  "evaluator.learning-feedback-adoption-rate-24h",
  "evaluator.project-finding-recurrence-rate-24h",
  "evaluator.project-feedback-acceptance-rate-7d",
  "evaluator.learning-feedback-adoption-rate-7d",
  "evaluator.project-finding-recurrence-rate-7d",
  "v2.spec-coverage-rate",
  "project.blocked-rate-7d",
  "capability.session-trace-completeness",
  "capability.tool-preset-drift-count",
  "capability.self-directed-iteration-rate-24h",
  "capability.process-uptime-h",
  "capability.concurrent-session-max-1h",
  "session.zero-op-error-count-1h",
  "guard.blocked-count-1h",
  "guard.blocked-count-24h",
  "system.real-output-24h",
  "v2.agent-config-bytes-p50",
  "v2.manager-loc",
  "v2.runtime-glue-loc",
  "v2.runagent-callsite-conformance",
  "v2.heartbeat-decision-rate",
  "v2.self-directed-iteration-rate-24h",
  "v2.session-trace-completeness",
  "v2.process-uptime-h",
  "v2.fork-on-breach-rate",
  "capability.breach-time-to-recovery-p50-h",
  "capability.unrecovered-breach-count-7d",
  "capability.cross-domain-handling-rate",
  "capability.journal-reference-rate",
  "capability.message-conversation-close-rate",
  "capability.trend-7d",
  "project.missing-owner-workflow-count",
  "project.reconcile.trigger-count",
  "project.reconcile.launched-count",
  "project.reconcile.event-latency-ms",
];

/** Snapshot retention: keep 30 days of history */
/**
 * Structurally-pinned metric allow-list — these metrics have a legitimate
 * steady-state of dv=1 (e.g. health metrics that remain 0 when healthy).
 * They are excluded from the structurally-pinned count so they don't fire
 * false-positive alerts.  (KE-938 / proposal: Option A guard-metric list)
 */
const STRUCTURALLY_PINNED_ALLOWLIST = new Set([
  "capability.zombie-session-count", // desired steady-state 0; alerts on non-zero
  "capability.status-reality-mismatch-count", // desired 0; multi-signal composite
  "infra.bus.subscriber-failed-count-1h", // desired 0; failure counter
  "infra.messages.delivery-rate", // desired 1.0; high-reliability gauge
]);

function projectSlugFromRef(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/\\/g, "/").replace(/\/+$/, "");
  return basename(normalized).trim() || null;
}

function projectSlugFromIterationData(data: string | null): string | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as {
      projectId?: unknown;
      project?: unknown;
    };
    const raw =
      typeof parsed.projectId === "string"
        ? parsed.projectId
        : typeof parsed.project === "string"
          ? parsed.project
          : "";
    return projectSlugFromRef(raw);
  } catch {
    return null;
  }
}

function countInvalidSharedProjectFormats(projectsRoot: string): number {
  if (!existsSync(projectsRoot)) return 0;

  let invalid = 0;
  for (const entry of readdirSync(projectsRoot)) {
    if (entry === "_archive") continue;
    const projectDir = join(projectsRoot, entry);
    try {
      if (!statSync(projectDir).isDirectory()) continue;
      const projectFile = join(projectDir, "project.md");
      if (!existsSync(projectFile)) continue;
      const content = readFileSync(projectFile, "utf-8");
      if (validateProjectFormat(content, entry).length > 0) invalid++;
    } catch {
      invalid++;
    }
  }
  return invalid;
}

function listEnabledHeartbeatAgents(
  agentsRoot: string,
  configuredAgents: Set<string>,
): string[] {
  const cronPath = join(agentsRoot, "may", "cron.json");
  const agents = new Set<string>();
  try {
    const cron = JSON.parse(readFileSync(cronPath, "utf8")) as Array<{
      name?: string;
      enabled?: boolean;
      agent?: string;
      handler?: string | { workflow?: string; agent?: string };
      handlerConfig?: { agent?: string; workflow?: string };
    }>;
    for (const entry of cron) {
      if (entry.enabled === false) continue;
      const workflowHandler =
        entry.handler && typeof entry.handler === "object"
          ? entry.handler
          : undefined;
      const isHeartbeat =
        entry.name === "heartbeat" ||
        entry.name?.startsWith("heartbeat-") ||
        entry.handlerConfig?.workflow?.includes("heartbeat") ||
        entry.handler === "heartbeat" ||
        workflowHandler?.workflow?.includes("heartbeat");
      if (!isHeartbeat) continue;
      const agent = (
        workflowHandler?.agent ||
        entry.handlerConfig?.agent ||
        entry.agent ||
        ""
      ).trim();
      if (agent && configuredAgents.has(agent)) agents.add(agent);
    }
  } catch {
    // No cron file means no scheduled heartbeat expectation.
  }
  return [...agents].sort();
}

function readFilePrefix(path: string, maxBytes = 512 * 1024): string {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytes = readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.toString("utf8", 0, bytes);
  } finally {
    closeSync(fd);
  }
}

function walkMarkdownFiles(root: string, maxFiles = 5000): string[] {
  const files: string[] = [];
  const visit = (dir: string) => {
    if (files.length >= maxFiles || !existsSync(dir)) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        files.length >= maxFiles ||
        entry === "node_modules" ||
        entry === ".git"
      )
        continue;
      const path = join(dir, entry);
      try {
        const stat = statSync(path);
        if (stat.isDirectory()) visit(path);
        else if (stat.isFile() && entry.endsWith(".md")) files.push(path);
      } catch {
        // Ignore unreadable files.
      }
    }
  };
  visit(root);
  return files;
}

function fileContains(path: string, patterns: RegExp[]): boolean {
  try {
    const content = readFilePrefix(path, 256 * 1024);
    return patterns.every((pattern) => pattern.test(content));
  } catch {
    return false;
  }
}

function fileContainsAny(path: string, patterns: RegExp[]): boolean {
  try {
    const content = readFilePrefix(path, 256 * 1024);
    return patterns.some((pattern) => pattern.test(content));
  } catch {
    return false;
  }
}

function scoutKnowledgePracticeLoaded(root: string): boolean {
  // Scout agent migrated to projects/scout-knowledge-lib.app/agents/scout/ (ea04018c3)
  // Check both new and legacy paths for resilience
  const paths = [
    join(
      root,
      "projects",
      "scout-knowledge-lib.app",
      "agents",
      "scout",
      "AGENTS.md",
    ),
    join(root, "agents", "scout", "AGENTS.md"),
  ];
  return paths.some((p) =>
    fileContains(p, [
      /search .*existing|existing .*update|update .*existing/i,
      /<ai_context>/i,
    ]),
  );
}

function scoutKnowledgePreambleCoverage(root: string): {
  value: number;
  sampleSize: number;
} {
  const files = [
    // Scout knowledge migrated to projects/scout-knowledge-lib/ (ea04018c3)
    ...walkMarkdownFiles(
      join(root, "projects", "scout-knowledge-lib", "knowledge"),
    ),
    ...walkMarkdownFiles(join(root, "agents", "scout", "knowledge")),
    ...walkMarkdownFiles(join(root, "shared", "knowledge", "entries")),
  ];
  if (files.length === 0) return { value: 1, sampleSize: 0 };
  const withPreamble = files.filter((file) =>
    fileContainsAny(file, [/<ai_context>/i]),
  ).length;
  return {
    value: parseFloat((withPreamble / files.length).toFixed(4)),
    sampleSize: files.length,
  };
}

function scoutSourcedArtifacts24h(root: string, now: number): number {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const roots = [
    // Scout agent/knowledge migrated to project paths (ea04018c3)
    join(root, "projects", "scout-knowledge-lib", "knowledge"),
    join(
      root,
      "projects",
      "scout-knowledge-lib.app",
      "agents",
      "scout",
      "workspace",
    ),
    join(root, "agents", "scout", "knowledge"),
    join(root, "agents", "scout", "workspace"),
    join(root, "shared", "knowledge", "entries"),
  ];
  return roots
    .flatMap((dir) => walkMarkdownFiles(dir))
    .filter((file) => {
      try {
        if (statSync(file).mtimeMs < cutoff) return false;
        return fileContainsAny(file, [
          /^Sources?:/im,
          /\*\*Sources?:?\*\*:?/i,
          /https?:\/\//i,
        ]);
      } catch {
        return false;
      }
    }).length;
}

function scoutDownstreamReferenceFiles7d(root: string, now: number): number {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  // Walk agents + shared normally; for projects, walk specific relevant subtrees
  // to avoid the 5000-file cap being exhausted by huge irrelevant dirs (aks-rp-e2e, _archive).
  const projectsDir = join(root, "projects");
  const projectSubdirs: string[] = [];
  try {
    for (const entry of readdirSync(projectsDir)) {
      // Skip huge irrelevant directories that exhaust the walk cap
      if (
        entry === "aks-rp-e2e" ||
        entry === "aks-rp-e2e.app" ||
        entry === "runs"
      )
        continue;
      if (entry === "_archive" || entry === "aks-explorer") continue;
      const p = join(projectsDir, entry);
      try {
        if (statSync(p).isDirectory()) projectSubdirs.push(p);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }

  return [
    ...walkMarkdownFiles(join(root, "agents")),
    ...projectSubdirs.flatMap((d) => walkMarkdownFiles(d)),
    ...walkMarkdownFiles(join(root, "shared", "may-agent-docs")),
  ].filter((file) => {
    // Exclude scout's own files (both legacy and new paths)
    if (file.includes("/agents/scout/")) return false;
    if (file.includes("/scout-knowledge-lib")) return false;
    try {
      if (statSync(file).mtimeMs < cutoff) return false;
      return fileContainsAny(file, [
        /agents\/scout\/knowledge/i,
        /scout-second-brain-learning/i,
        /scout-knowledge-lib/i,
        /\bScout\b/,
      ]);
    } catch {
      return false;
    }
  }).length;
}

function sessionJsonlPath(
  persistDir: string,
  sessionId: string,
): string | null {
  const active = join(persistDir, "sessions", sessionId, "session.jsonl");
  if (existsSync(active)) return active;
  const archived = join(
    persistDir,
    "sessions",
    "history",
    sessionId,
    "session.jsonl",
  );
  return existsSync(archived) ? archived : null;
}

function sessionInactiveSince(
  persistDir: string,
  sessionId: string,
  cutoffMs: number,
): boolean {
  const path = sessionJsonlPath(persistDir, sessionId);
  if (!path) return true;
  try {
    return statSync(path).mtimeMs < cutoffMs;
  } catch {
    return true;
  }
}

function assistantHasProviderError(msg: any): boolean {
  const stopReason = String(msg?.stopReason ?? "").toLowerCase();
  const errorMessage = String(msg?.errorMessage ?? "").toLowerCase();
  return (
    stopReason === "error" ||
    /connection error|rate limit|unauthorized|forbidden|unsupported model|unknown model|overloaded|timeout|api/.test(
      errorMessage,
    )
  );
}

function hasFirstAssistantProviderError(
  persistDir: string,
  sessionId: string,
): boolean {
  const path = sessionJsonlPath(persistDir, sessionId);
  if (!path) return false;
  try {
    const prefix = readFilePrefix(path);
    for (const line of prefix.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (msg?.role !== "assistant") continue;
      return assistantHasProviderError(msg);
    }
  } catch {
    return false;
  }
  return false;
}

function hasAnyAssistantProviderError(
  persistDir: string,
  sessionId: string,
): boolean {
  const path = sessionJsonlPath(persistDir, sessionId);
  if (!path) return false;
  try {
    const prefix = readFilePrefix(path);
    for (const line of prefix.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (msg?.role === "assistant" && assistantHasProviderError(msg))
        return true;
    }
  } catch {
    return false;
  }
  return false;
}

function hasEmptyAssistantStop(persistDir: string, sessionId: string): boolean {
  const path = sessionJsonlPath(persistDir, sessionId);
  if (!path) return false;
  try {
    const prefix = readFilePrefix(path);
    for (const line of prefix.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (msg?.role !== "assistant") continue;
      const content = msg.content;
      const emptyContent = Array.isArray(content)
        ? content.length === 0
        : typeof content === "string"
          ? content.trim().length === 0
          : content == null;
      return (
        emptyContent && String(msg.stopReason ?? "").toLowerCase() === "stop"
      );
    }
  } catch {
    return false;
  }
  return false;
}

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry,
) => {
  return async (_event?: EventEnvelope) => {
    const db = ctx.sdk.getDb();
    const now = Date.now();

    // ── Helpers ──────────────────────────────────────────────────────

    function record(
      id: string,
      value: number,
      sampleSize?: number,
      note?: string,
      measuredAt?: number,
    ) {
      const effectiveMeasuredAt = measuredAt ?? now;
      metricService.record(
        id,
        value,
        sampleSize != null || note != null || measuredAt != null
          ? { sampleSize, measuredAt: effectiveMeasuredAt, note }
          : { measuredAt: effectiveMeasuredAt },
      );
    }

    function count(query: string, ...args: any[]): number {
      return (db.prepare(query).get(...args) as any)?.c || 0;
    }

    function terminalSessionsWithoutEndEvent(
      since: number,
      limit = 5000,
    ): Array<{
      sessionId: string;
      agent: string;
      status: string;
      endedAt: number | null;
    }> {
      const sessions = db
        .prepare(
          `SELECT sessionId, agent, status, endedAt
         FROM sessions
         WHERE status IN ('done', 'error', 'interrupted')
           AND startedAt > ?
         ORDER BY startedAt DESC
         LIMIT ?`,
        )
        .all(since, limit) as Array<{
        sessionId: string;
        agent: string;
        status: string;
        endedAt: number | null;
      }>;
      if (sessions.length === 0) return [];

      const endRows = db
        .prepare(
          `SELECT data
         FROM events
         WHERE event_type = 'session.end'
           AND timestamp > ?`,
        )
        .all(since) as Array<{ data: string | null }>;

      const ended = new Set<string>();
      for (const row of endRows) {
        if (!row.data) continue;
        try {
          const parsed = JSON.parse(row.data) as { sessionId?: unknown };
          if (typeof parsed.sessionId === "string" && parsed.sessionId)
            ended.add(parsed.sessionId);
        } catch {
          // Ignore malformed historic event payloads.
        }
      }
      return sessions.filter((session) => !ended.has(session.sessionId));
    }

    const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);
    const metricService = ctx.sdk.metrics;
    if (!metricService) throw new Error("MetricService unavailable on ctx.sdk");

    // ── Ensure metric rows exist ─────────────────────────────────────

    metricService.defineMany(
      ALL_METRICS.map((m) => ({
        ...m,
        alertOp: m.alert_op,
        status: "active",
        speed: "fast",
      })),
    );
    db.run("UPDATE metrics SET priority = 'P2' WHERE priority IS NULL");

    // Historical rows remain queryable, but retired/noncritical metrics should
    // not appear in active watches or keep unresolved alerts alive.
    try {
      const placeholders = RETIRED_METRIC_IDS.map(() => "?").join(", ");
      db.run(
        `UPDATE metrics
         SET status = 'retired', closed_at = COALESCE(closed_at, ?), updated_at = ?
         WHERE id IN (${placeholders}) OR id LIKE 'agent.%.low-quality-streak'`,
        [now, now, ...RETIRED_METRIC_IDS],
      );
      db.run(
        `UPDATE metric_alerts
         SET resolved_at = COALESCE(resolved_at, ?)
         WHERE resolved_at IS NULL
           AND (metric_id IN (${placeholders}) OR metric_id LIKE 'agent.%.low-quality-streak')`,
        [now, ...RETIRED_METRIC_IDS],
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error retiring noncritical metrics: ${e}`,
      );
    }

    // ── Measure: Handler (with error isolation) ──────────────────────

    const sixH = now - 6 * 3600000;
    const threeH = now - 3 * 3600000;
    const twoH = now - 2 * 3600000;
    const oneH = now - 3600000;
    const fifteenMinutesAgo = now - 15 * 60_000;
    const twentyFourH = now - 24 * 3600000;
    const sevenMinutesAgo = now - 7 * 60_000;
    const staleRunningCutoff = now - 30 * 60_000;

    let completed = 0,
      failed = 0;

    try {
      completed = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?",
        sixH,
      );
      failed = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?",
        sixH,
      );
      record("handler.completed-count", completed);
      record("handler.failed-count", failed);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring handler counts: ${e}`,
      );
    }

    try {
      const total = completed + failed;
      record(
        "handler.success-rate",
        total > 0 ? parseFloat((completed / total).toFixed(4)) : 1,
        total,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring success-rate: ${e}`,
      );
    }

    try {
      // Count agents that actually ran a heartbeat SESSION (not just the handler).
      // The handler fires even when the workflow fails to load — sessions are the real signal.
      const coverage = count(
        `SELECT COUNT(DISTINCT agent) as c FROM sessions
         WHERE startedAt > ?
           AND (source LIKE 'workflow:%heartbeat%' OR source = 'heartbeat' OR task LIKE '[heartbeat]%'
                OR task LIKE 'You are %waking up for your heartbeat.%')`,
        twoH,
      );
      record("handler.heartbeat-coverage", coverage);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring heartbeat-coverage: ${e}`,
      );
    }

    try {
      const heartbeatAgents = listEnabledHeartbeatAgents(
        ctx.sdk.paths.agents,
        configuredAgents,
      );
      let dark = 0;
      for (const agent of heartbeatAgents) {
        const recent = count(
          `SELECT COUNT(*) as c FROM sessions
           WHERE agent = ?
             AND startedAt > ?
             AND (source LIKE 'workflow:%heartbeat%' OR source = 'heartbeat' OR task LIKE '[heartbeat]%'
                  OR task LIKE 'You are %waking up for your heartbeat.%')`,
          agent,
          twoH,
        );
        if (recent === 0) dark++;
      }
      record("agent.heartbeat-dark-count-2h", dark, heartbeatAgents.length);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring agent.heartbeat-dark-count-2h: ${e}`,
      );
    }

    try {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(COALESCE(json_extract(data, '$.count'), 1)), 0) as c
         FROM events
         WHERE event_type = 'agent.config_invalid'
           AND timestamp > ?`,
        )
        .get(oneH) as { c?: number } | undefined;
      record("agent.config-invalid-count-1h", Number(row?.c ?? 0));
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring agent.config-invalid-count-1h: ${e}`,
      );
    }

    try {
      const row = db
        .prepare(
          `SELECT MAX(timestamp) as lastHeartbeat
         FROM events
         WHERE event_type = 'runtime.daemon.heartbeat'`,
        )
        .get() as { lastHeartbeat?: number | null } | undefined;
      const lastHeartbeat = Number(row?.lastHeartbeat ?? 0);
      record(
        "runtime.daemon-heartbeat-stale",
        lastHeartbeat > 0 && now - lastHeartbeat <= 7 * 60_000 ? 0 : 1,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring runtime.daemon-heartbeat-stale: ${e}`,
      );
    }

    try {
      const matureCutoff = now - 2 * 60_000;
      const row = db
        .prepare(
          `WITH scheduled AS (
           SELECT id,
                  timestamp,
                  owner,
                  source,
                  substr(
                    substr(source, length('project-app:') + 1),
                    1,
                    instr(substr(source, length('project-app:') + 1), ':schedule:') - 1
                  ) as app_id,
                  substr(
                    substr(source, length('project-app:') + 1),
                    instr(substr(source, length('project-app:') + 1), ':schedule:') + length(':schedule:')
                  ) as schedule_id,
                  CASE
                    WHEN json_valid(data) THEN COALESCE(
                      json_extract(data, '$.project'),
                      json_extract(data, '$.projectId')
                    )
                    ELSE NULL
                  END as project
             FROM events
            WHERE timestamp > ?
              AND timestamp < ?
              AND source LIKE 'project-app:%:schedule:%'
         )
         SELECT COUNT(*) as c
           FROM scheduled s
          WHERE NOT EXISTS (
            SELECT 1
              FROM events follow
             WHERE follow.timestamp >= s.timestamp
               AND follow.timestamp <= s.timestamp + 2 * 60 * 1000
               AND follow.event_type IN (
                 'handler.started',
                 'handler.completed',
                 'handler.workflow_dispatched',
                 'project.owner.requested',
                 'project.ops_health.observed',
                 'project.ops_digest.created'
               )
               AND (
                 (
                   follow.event_type = 'handler.started'
                   AND json_valid(follow.data)
                   AND json_extract(follow.data, '$.handler') NOT IN (
                     s.app_id || '-schedule-' || s.schedule_id,
                     s.app_id || '-' || s.schedule_id
                   )
                   AND follow.owner = s.owner
                 )
                 OR (
                   follow.event_type = 'handler.completed'
                   AND json_valid(follow.data)
                   AND json_extract(follow.data, '$.handler') IN (
                     s.app_id || '-schedule-' || s.schedule_id,
                     s.app_id || '-' || s.schedule_id
                   )
                 )
                 OR (
                   json_valid(follow.data)
                   AND (
                     json_extract(follow.data, '$.project') = s.project
                     OR json_extract(follow.data, '$.projectId') = s.project
                   )
                 )
               )
          )`,
        )
        .get(oneH, matureCutoff) as { c?: number } | undefined;
      record(
        "runtime.project-app-schedule-orphan-count-1h",
        Number(row?.c ?? 0),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring runtime.project-app-schedule-orphan-count-1h: ${e}`,
      );
    }

    try {
      // Exclude long-running agent session handlers from p95 — heartbeats,
      // eval-poller, and task-execution-workers are agent sessions that run for
      // minutes/hours, not infrastructure reactor latency. Including them makes
      // this metric unactionable for handler health.
      const durations = (
        db
          .prepare(
            `SELECT json_extract(data, '$.durationMs') as dur FROM events
         WHERE event_type = 'handler.completed' AND timestamp > ?
           AND COALESCE(json_extract(data, '$.handler'), '') != 'heartbeat'
           AND COALESCE(json_extract(data, '$.handler'), '') NOT LIKE 'heartbeat-%'
           AND COALESCE(json_extract(data, '$.handler'), '') != 'eval-poller'
           AND COALESCE(json_extract(data, '$.handler'), '') NOT LIKE '%-task-execution-worker'
         ORDER BY dur ASC`,
          )
          .all(sixH) as any[]
      )
        .map((r) => r.dur)
        .filter((d) => d != null);
      if (durations.length > 0) {
        const p95 =
          durations[
            Math.min(Math.floor(durations.length * 0.95), durations.length - 1)
          ];
        record("handler.p95-duration", p95, durations.length);
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring p95-duration: ${e}`,
      );
    }

    try {
      record(
        "handler.fires-per-hour",
        count(
          "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.started' AND timestamp > ?",
          oneH,
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring fires-per-hour: ${e}`,
      );
    }

    // ── Measure: Sessions/System output (with error isolation) ───────

    try {
      // Only terminal sessions belong in the denominator. Including in-flight
      // `running` sessions makes the rate look healthier while work is still
      // underway and can hide short auth/API failure bursts.
      const total = count(
        "SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')",
        sixH,
      );
      const err = count(
        `SELECT COUNT(*) as c
         FROM sessions
         WHERE startedAt > ?
           AND (status = 'error' OR (status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'))`,
        sixH,
      );
      record(
        "session.error-rate-6h",
        total > 0 ? parseFloat((err / total).toFixed(4)) : 0,
        total,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring session.error-rate-6h: ${e}`,
      );
    }

    try {
      const total = count(
        `SELECT COUNT(*) as c
         FROM sessions
         WHERE startedAt > ?
           AND source = 'workflow:project-planner'
           AND status IN ('done', 'error', 'interrupted')`,
        sixH,
      );
      const timeoutLike = count(
        `SELECT COUNT(*) as c
         FROM sessions
         WHERE startedAt > ?
           AND source = 'workflow:project-planner'
           AND status IN ('error', 'interrupted')
           AND (
             lower(COALESCE(error, '')) LIKE '%timeout%'
             OR status = 'interrupted'
             OR (status = 'error' AND COALESCE(endedAt, startedAt) - startedAt >= 4 * 60 * 1000)
           )`,
        sixH,
      );
      record(
        "session.planner-timeout-rate-6h",
        total >= 5 ? parseFloat((timeoutLike / total).toFixed(4)) : 0,
        total,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring session.planner-timeout-rate-6h: ${e}`,
      );
    }

    try {
      const candidates = db
        .prepare(
          `SELECT sessionId
         FROM sessions
         WHERE startedAt > ?
           AND COALESCE(error, '') != 'Clean start (fresh)'
           AND status IN ('error', 'interrupted')
         ORDER BY startedAt DESC
         LIMIT 200`,
        )
        .all(oneH) as Array<{ sessionId: string }>;
      const persistDir = ctx.sdk.paths.persist ?? ctx.sdk.paths.root;
      const firstTurnErrors = candidates.filter((s) =>
        hasFirstAssistantProviderError(persistDir, s.sessionId),
      ).length;
      const providerErrors = candidates.filter((s) =>
        hasAnyAssistantProviderError(persistDir, s.sessionId),
      ).length;
      record(
        "session.first-turn-error-count-1h",
        firstTurnErrors,
        candidates.length,
      );
      record(
        "session.provider-error-count-1h",
        providerErrors,
        candidates.length,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring provider-error session metrics: ${e}`,
      );
    }

    try {
      const candidates = db
        .prepare(
          `SELECT sessionId
         FROM sessions
         WHERE startedAt > ?
           AND status IN ('error', 'interrupted')
           AND COALESCE(error, '') != 'Clean start (fresh)'
         ORDER BY startedAt DESC
         LIMIT 300`,
        )
        .all(oneH) as Array<{ sessionId: string }>;
      const persistDir = ctx.sdk.paths.persist ?? ctx.sdk.paths.root;
      const emptyStops = candidates.filter((s) =>
        hasEmptyAssistantStop(persistDir, s.sessionId),
      ).length;
      record(
        "session.empty-assistant-stop-count-1h",
        emptyStops,
        candidates.length,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring session.empty-assistant-stop-count-1h: ${e}`,
      );
    }

    try {
      record(
        "message.delivery-failed-count-1h",
        count(
          "SELECT COUNT(*) as c FROM events WHERE event_type = 'message.delivery_failed' AND timestamp > ?",
          oneH,
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring message.delivery-failed-count-1h: ${e}`,
      );
    }

    try {
      record(
        "escalation.pending-count",
        count(
          `SELECT COUNT(*) as c
           FROM events created
           WHERE created.event_type = 'escalation.created'
             AND COALESCE(created.status, 'pending') NOT IN ('resolved', 'dismissed', 'handled')
             AND json_valid(created.data)
             AND NOT EXISTS (
               SELECT 1
               FROM events closed
               WHERE closed.event_type IN ('escalation.resolved', 'escalation.dismissed')
                 AND json_valid(closed.data)
                 AND json_extract(closed.data, '$.escalationId') = json_extract(created.data, '$.escalationId')
             )`,
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring escalation.pending-count: ${e}`,
      );
    }

    try {
      record(
        "infra.bus.subscriber-failed-count-1h",
        count(
          "SELECT COUNT(*) as c FROM events WHERE event_type = 'subscriber.failed' AND timestamp > ?",
          oneH,
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring infra.bus.subscriber-failed-count-1h: ${e}`,
      );
    }

    try {
      const guardTriggered = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'guard.triggered' AND timestamp > ?",
        twentyFourH,
      );
      const guardWarned = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'guard.triggered' AND timestamp > ? AND json_valid(data) AND json_extract(data, '$.demandType') = 'warn'",
        twentyFourH,
      );
      const guardBlocked = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'guard.triggered' AND timestamp > ? AND json_valid(data) AND json_extract(data, '$.demandType') = 'block'",
        fifteenMinutesAgo,
      );
      const guardRepeated = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'guard.triggered' AND timestamp > ? AND json_valid(data) AND json_extract(data, '$.action') = 'skipped_duplicate'",
        twentyFourH,
      );
      record("guard.triggered-count-24h", guardTriggered);
      record("guard.warned-count-24h", guardWarned);
      record("guard.blocked-count-15m", guardBlocked);
      record("guard.repeat-trigger-count-24h", guardRepeated);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring guard trigger metrics: ${e}`,
      );
    }

    try {
      const failedRows = db
        .prepare(
          `SELECT s.sessionId,
                  MAX(CASE WHEN e.sessionId IS NOT NULL THEN 1 ELSE 0 END) as triaged
         FROM sessions s
         LEFT JOIN evaluations e ON e.sessionId = s.sessionId
         WHERE s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?
           AND COALESCE(s.error, '') != 'Clean start (fresh)'
           AND (s.status IN ('error', 'interrupted') OR s.error IS NOT NULL)
           AND NOT (s.status = 'interrupted' AND s.error IS NULL)
         GROUP BY s.sessionId`,
        )
        .all(threeH, sevenMinutesAgo) as Array<{
        sessionId: string;
        triaged: number;
      }>;
      const failed = failedRows.length;
      // Any evaluation row — regardless of verdict — means the failure was
      // triaged. The old filter `IN ('needs_improvement', 'skipped')` excluded
      // sessions whose verdict was 'acceptable' or 'good', deflating the rate
      // even though the evaluator did look at them.
      const triaged = failedRows.filter(
        (row) => Number(row.triaged) > 0,
      ).length;
      // Small failure counts cause this metric to flap around a single recently-ended
      // session before evaluator aftermath catches up. Keep the signal meaningful by
      // treating windows with fewer than 5 failed sessions as neutral while still
      // recording the denominator in sample_size for operator visibility.
      record(
        "session.failed-triage-rate-3h",
        failed >= 5 ? parseFloat((triaged / failed).toFixed(4)) : 1,
        failed,
        JSON.stringify({
          failed,
          triaged,
          failedIds: failedRows.slice(0, 20).map((row) => row.sessionId),
        }),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring session.failed-triage-rate-3h: ${e}`,
      );
    }

    try {
      // This is a pipeline liveness/meta signal, not the north-star quality
      // metric. A small threshold catches "evaluator stopped entirely" without
      // making raw coverage the goal.
      const eligible = count(
        `SELECT COUNT(*) as c
         FROM sessions s
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?`,
        threeH,
        sevenMinutesAgo,
      );
      const evaluated = count(
        `SELECT COUNT(DISTINCT s.sessionId) as c
         FROM sessions s
         JOIN evaluations e ON e.sessionId = s.sessionId
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?`,
        threeH,
        sevenMinutesAgo,
      );
      record(
        "evaluator.aftermath-coverage-rate-3h",
        eligible > 0 ? parseFloat((evaluated / eligible).toFixed(4)) : 1,
        eligible,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator.aftermath-coverage-rate-3h: ${e}`,
      );
    }

    try {
      const lastNonHeuristicEval = (
        db
          .prepare(
            "SELECT MAX(createdAt) as lastCreatedAt FROM evaluations WHERE evaluatedByHeuristic = 0",
          )
          .get() as any
      )?.lastCreatedAt as number | null | undefined;
      const lagH = lastNonHeuristicEval
        ? (now - lastNonHeuristicEval) / 3600000
        : 9999;
      record("eval.llm-coverage-lag-h", parseFloat(lagH.toFixed(2)));
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring eval.llm-coverage-lag-h: ${e}`,
      );
    }

    try {
      record(
        "eval.llm-evals-24h",
        count(
          `SELECT COUNT(*) as c
           FROM evaluations
           WHERE evaluatedByHeuristic = 0
             AND createdAt > ?
             AND agent NOT IN ('evaluator', 'judge')`,
          twentyFourH,
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring eval.llm-evals-24h: ${e}`,
      );
    }

    try {
      const total = count(
        `SELECT COUNT(*) as c
         FROM evaluations
         WHERE createdAt > ?
           AND agent NOT IN ('evaluator', 'judge')
           AND verdict != 'skipped'`,
        twentyFourH,
      );
      const needsImprovementOrLowScore = count(
        `SELECT COUNT(*) as c
         FROM evaluations
         WHERE createdAt > ?
           AND agent NOT IN ('evaluator', 'judge')
           AND verdict != 'skipped'
           AND (verdict IN ('needs_improvement', 'low_quality') OR quality < 0.4 OR efficiency < 0.4)`,
        twentyFourH,
      );
      record(
        "evaluator.low-quality-rate-24h",
        total > 0
          ? parseFloat((needsImprovementOrLowScore / total).toFixed(4))
          : 0,
        total,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator.low-quality-rate-24h: ${e}`,
      );
    }

    try {
      const total = count(
        `SELECT COUNT(*) as c
         FROM evaluations
         WHERE createdAt > ?
           AND agent NOT IN ('evaluator', 'judge')
           AND verdict != 'skipped'`,
        twentyFourH,
      );
      const substantiveLowQuality = count(
        `SELECT COUNT(*) as c
         FROM evaluations e
         LEFT JOIN sessions s ON s.sessionId = e.sessionId
         WHERE e.createdAt > ?
           AND e.agent NOT IN ('evaluator', 'judge')
           AND e.verdict != 'skipped'
           AND (
             lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
             OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
             OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
             OR lower(COALESCE(e.issues, '')) LIKE '%fabricated%'
             OR lower(COALESCE(e.issues, '')) LIKE '%hallucinated path%'
           )`,
        twentyFourH,
      );
      record(
        "evaluator.substantive-low-quality-rate-24h",
        total > 0 ? parseFloat((substantiveLowQuality / total).toFixed(4)) : 0,
        total,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator.substantive-low-quality-rate-24h: ${e}`,
      );
    }

    try {
      const routedForReview = count(
        `SELECT COUNT(*) as c
         FROM events
         WHERE event_type = 'evaluation.routed'
           AND timestamp > ?
           AND json_extract(data, '$.lane') IN ('needs_triage', 'success_candidate')`,
        twentyFourH,
      );
      const reviewed = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.reviewed' AND timestamp > ?",
        twentyFourH,
      );
      record(
        "evaluator.meaningful-review-rate-24h",
        routedForReview > 0
          ? parseFloat(
              (Math.min(reviewed, routedForReview) / routedForReview).toFixed(
                4,
              ),
            )
          : 1,
        routedForReview,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator.meaningful-review-rate-24h: ${e}`,
      );
    }

    try {
      const triageRouted = count(
        `SELECT COUNT(*) as c
         FROM events
         WHERE event_type = 'evaluation.routed'
           AND timestamp > ?
           AND json_extract(data, '$.lane') = 'needs_triage'`,
        twentyFourH,
      );
      const triageClosed = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.triage_closed' AND timestamp > ?",
        twentyFourH,
      );
      record(
        "evaluator.triage-closure-rate-24h",
        triageRouted > 0
          ? parseFloat(
              (Math.min(triageClosed, triageRouted) / triageRouted).toFixed(4),
            )
          : 1,
        triageRouted,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator.triage-closure-rate-24h: ${e}`,
      );
    }

    try {
      const reviewedGood = count(
        `SELECT COUNT(*) as c
         FROM events
         WHERE event_type = 'evaluation.reviewed'
           AND timestamp > ?
           AND json_extract(data, '$.verdict') = 'good'`,
        twentyFourH,
      );
      const falseGood = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.false_good' AND timestamp > ?",
        twentyFourH,
      );
      record(
        "evaluator.false-good-rate-sample",
        reviewedGood > 0
          ? parseFloat((falseGood / reviewedGood).toFixed(4))
          : 0,
        reviewedGood,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator.false-good-rate-sample: ${e}`,
      );
    }

    try {
      const outcomeWindowStart = twentyFourH;
      const feedbackTotal = count(
        `SELECT COUNT(*) AS c
           FROM events
          WHERE event_type = 'project.owner.requested'
            AND source = 'evaluation.app'
            AND timestamp > ?
            AND json_extract(data, '$.reason') = 'evaluation-project-health-feedback'`,
        outcomeWindowStart,
      );
      const feedbackDelivered = count(
        `SELECT COUNT(*) AS c
           FROM events
          WHERE event_type = 'project.owner.requested'
            AND source = 'evaluation.app'
            AND (accepted_at IS NOT NULL OR COALESCE(status, 'pending') IN ('handled', 'completed', 'resolved'))
            AND timestamp > ?
            AND json_extract(data, '$.reason') = 'evaluation-project-health-feedback'`,
        outcomeWindowStart,
      );
      record(
        "evaluator.project-finding-delivery-rate-24h",
        feedbackTotal > 0
          ? parseFloat((feedbackDelivered / feedbackTotal).toFixed(4))
          : 1,
        feedbackTotal,
      );

      const oldestPending = (
        db
          .prepare(
            `SELECT MIN(timestamp) AS timestamp
               FROM events
              WHERE event_type = 'project.owner.requested'
                AND source = 'evaluation.app'
                AND accepted_at IS NULL
                AND COALESCE(status, 'pending') NOT IN ('handled', 'completed', 'resolved')
                AND timestamp > ?
                AND json_extract(data, '$.reason') = 'evaluation-project-health-feedback'`,
          )
          .get(outcomeWindowStart) as { timestamp?: number | null }
      )?.timestamp;
      record(
        "evaluator.project-feedback-pending-age-h",
        oldestPending
          ? parseFloat(((now - oldestPending) / 3_600_000).toFixed(2))
          : 0,
        feedbackTotal - feedbackDelivered,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring evaluator finding delivery: ${e}`,
      );
    }

    try {
      const persistDir = ctx.sdk.paths.persist ?? ctx.sdk.paths.root;
      const candidates = db
        .prepare(
          `SELECT sessionId
         FROM sessions
         WHERE status IN ('running', 'idle')
           AND agent NOT IN ('evaluator', 'judge', 'master')
           AND (kind IS NULL OR kind != 'chat')
           AND startedAt < ?
         ORDER BY startedAt ASC
         LIMIT 500`,
        )
        .all(staleRunningCutoff) as Array<{ sessionId: string }>;
      const inactive = candidates.filter((s) =>
        sessionInactiveSince(persistDir, s.sessionId, staleRunningCutoff),
      ).length;
      record(
        "runtime.stale-running-session-count",
        inactive,
        candidates.length,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring runtime.stale-running-session-count: ${e}`,
      );
    }

    try {
      record(
        "scout.knowledge-practice-loaded",
        scoutKnowledgePracticeLoaded(ctx.sdk.paths.root) ? 1 : 0,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring scout.knowledge-practice-loaded: ${e}`,
      );
    }

    try {
      const coverage = scoutKnowledgePreambleCoverage(ctx.sdk.paths.root);
      record(
        "scout.knowledge-preamble-coverage",
        coverage.value,
        coverage.sampleSize,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring scout.knowledge-preamble-coverage: ${e}`,
      );
    }

    try {
      record(
        "scout.sourced-artifacts-24h",
        scoutSourcedArtifacts24h(ctx.sdk.paths.root, now),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring scout.sourced-artifacts-24h: ${e}`,
      );
    }

    try {
      record(
        "scout.downstream-reference-files-7d",
        scoutDownstreamReferenceFiles7d(ctx.sdk.paths.root, now),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring scout.downstream-reference-files-7d: ${e}`,
      );
    }

    // ── Measure: Project (with error isolation) ──────────────────────

    const fortyEightH = now - 48 * 3600000;
    const sevenD = now - 7 * 86400000;

    try {
      record(
        "project.active-count",
        count("SELECT COUNT(*) as c FROM projects WHERE status = 'active'"),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring active-count: ${e}`,
      );
    }

    try {
      record(
        "project.blocked-count",
        count("SELECT COUNT(*) as c FROM projects WHERE status = 'blocked'"),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring blocked-count: ${e}`,
      );
    }

    // Stale: active projects with no activity event in 48h (single query, no N+1)
    // v3 project apps emit project.owner.requested / project.reviewed / project.tick
    // instead of the legacy project.iteration event. Count any of these as activity.
    // Match on both the DB id (e.g. "may-agent.app") and the project slug without .app
    // (e.g. "may-agent") since event sources use the slug form (project-app:may-agent).
    try {
      const stale = count(
        `SELECT COUNT(*) as c FROM projects p
         WHERE p.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type IN ('project.iteration', 'project.owner.requested', 'project.reviewed', 'project.tick')
               AND e.timestamp > ?
               AND (e.data LIKE '%' || p.id || '%'
                    OR e.source LIKE '%' || p.id || '%'
                    OR e.data LIKE '%' || REPLACE(p.id, '.app', '') || '%'
                    OR e.source LIKE '%' || REPLACE(p.id, '.app', '') || '%')
           )`,
        fortyEightH,
      );
      record("project.stale-active-count", stale);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring stale-active-count: ${e}`,
      );
    }

    try {
      const activeProjectSlugs = new Set(
        (
          db
            .prepare(
              "SELECT id, name, path FROM projects WHERE status = 'active'",
            )
            .all() as Array<{ id: string; name: string; path: string }>
        )
          .flatMap((p) => [p.id, p.name, projectSlugFromRef(p.path)])
          .filter((slug): slug is string => Boolean(slug)),
      );
      const iterationRows = db
        .prepare(
          "SELECT data FROM events WHERE event_type = 'project.iteration' AND timestamp > ?",
        )
        .all(twentyFourH) as Array<{ data: string | null }>;
      const activeIterations = iterationRows.filter((row) => {
        const slug = projectSlugFromIterationData(row.data);
        return slug != null && activeProjectSlugs.has(slug);
      }).length;
      record("project.iterations-24h", activeIterations, iterationRows.length);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring iterations-24h: ${e}`,
      );
    }

    try {
      record(
        "project.blocked-over-6h",
        count(
          "SELECT COUNT(*) as c FROM projects WHERE status = 'blocked' AND updated_at < ?",
          now - 6 * 3600000,
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring blocked-over-6h: ${e}`,
      );
    }

    try {
      record(
        "project.invalid-format-count",
        countInvalidSharedProjectFormats(
          ctx.sdk.paths.projects ?? join(ctx.sdk.paths.root, "projects"),
        ),
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring invalid-format-count: ${e}`,
      );
    }

    // ── Measure: status honesty ─────────────────────────────────────

    // C7: Zombie session count (running >30min without recent transcript activity)
    try {
      const persistDir = ctx.sdk.paths.persist ?? ctx.sdk.paths.root;
      const candidates = db
        .prepare(
          `SELECT sessionId
         FROM sessions
         WHERE status IN ('running', 'idle')
           AND startedAt < ?
         ORDER BY startedAt ASC
         LIMIT 500`,
        )
        .all(staleRunningCutoff) as Array<{ sessionId: string }>;
      const zombies = candidates.filter((s) =>
        sessionInactiveSince(persistDir, s.sessionId, staleRunningCutoff),
      ).length;
      record("capability.zombie-session-count", zombies, candidates.length);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring zombie-session-count: ${e}`,
      );
    }

    try {
      const staleActiveProjects = count(
        `SELECT COUNT(*) as c FROM projects p
         WHERE p.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type IN ('project.iteration', 'project.owner.requested', 'project.reviewed', 'project.tick')
               AND e.timestamp > ?
               AND (e.data LIKE '%' || p.id || '%'
                    OR e.source LIKE '%' || p.id || '%'
                    OR e.data LIKE '%' || REPLACE(p.id, '.app', '') || '%'
                    OR e.source LIKE '%' || REPLACE(p.id, '.app', '') || '%')
           )`,
        sevenD,
      );

      const staleActiveMetrics = count(
        `SELECT COUNT(*) as c FROM metrics m
         WHERE m.status = 'active'
           AND m.created_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM metric_snapshots s
             WHERE s.metric_id = m.id
               AND s.measured_at > ?
           )`,
        now,
        now - 2 * 3600000,
      ); // Exclude just-created metrics; 2h window for snapshot staleness

      let missingEndSessions = terminalSessionsWithoutEndEvent(
        now - 24 * 3600000,
      );
      let terminalSessionsWithoutEnd = missingEndSessions.length;

      // Only check agents that have an enabled heartbeat cron job.
      const heartbeatAgents = listEnabledHeartbeatAgents(
        ctx.sdk.paths.agents,
        configuredAgents,
      );

      let agentsWithoutHeartbeat = 0;
      for (const agent of heartbeatAgents) {
        const recentHeartbeat = count(
          `SELECT COUNT(*) as c FROM events
           WHERE event_type = 'handler.completed'
             AND json_valid(data)
             AND (json_extract(data, '$.agent') = ? OR json_extract(data, '$.handler') LIKE ?)
             AND json_extract(data, '$.handler') LIKE 'heartbeat%'
             AND timestamp > ?`,
          agent,
          `heartbeat-${agent}%`,
          now - 4 * 3600000,
        );
        if (recentHeartbeat === 0) agentsWithoutHeartbeat++;
      }

      // ── Reconciliation: emit session.end for orphaned terminal sessions before recording state ──
      if (terminalSessionsWithoutEnd > 0) {
        try {
          const orphaned = missingEndSessions.slice(0, 50);
          const insert = db.prepare(
            "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
          );
          for (const s of orphaned) {
            insert.run(
              "session.end",
              JSON.stringify({
                sessionId: s.sessionId,
                agent: s.agent,
                status: s.status,
                reconciled: true,
              }),
              s.endedAt || now,
            );
          }
          if (orphaned.length > 0)
            ctx.sdk.log(
              "info",
              `[metrics-snapshot] Reconciled ${orphaned.length} orphaned session.end events`,
            );
          missingEndSessions = terminalSessionsWithoutEndEvent(
            now - 24 * 3600000,
          );
          terminalSessionsWithoutEnd = missingEndSessions.length;
        } catch (reconErr) {
          /* best-effort reconciliation */
        }
      }

      const mismatchCount =
        staleActiveProjects +
        staleActiveMetrics +
        terminalSessionsWithoutEnd +
        agentsWithoutHeartbeat;
      record(
        "capability.status-reality-mismatch-count",
        mismatchCount,
        heartbeatAgents.length +
          staleActiveProjects +
          staleActiveMetrics +
          terminalSessionsWithoutEnd,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring status-reality mismatch: ${e}`,
      );
    }

    // I1: infra.bus.event-count-1h — events in the last hour
    try {
      const eventCount1h = count(
        "SELECT COUNT(*) as c FROM events WHERE timestamp > ?",
        now - 3600000,
      );
      record("infra.bus.event-count-1h", eventCount1h);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring infra.bus.event-count-1h: ${e}`,
      );
    }

    // I2: infra.persist.db-size-mb — Logical DB size via PRAGMA (stable, ignores WAL checkpoint transients)
    //
    // Previous approach used statSync(db) + statSync(wal) + statSync(shm) which
    // caught transient WAL checkpoint spikes (~2x actual size) every ~3h when
    // SQLite checkpoints the WAL back into the main file. This caused 17+
    // breach→recover oscillations per day despite the DB being stable at ~2.2GB.
    //
    // PRAGMA page_count * page_size gives the committed logical size which is
    // what matters for capacity planning and doesn't oscillate during checkpoints.
    //
    // IMPORTANT: Run a PASSIVE checkpoint before measuring. Without this, PRAGMA
    // page_count includes pages written to WAL by a prior VACUUM (which rewrites
    // the entire DB through WAL), doubling the reported size until the next
    // checkpoint. PASSIVE is safe (doesn't block writers) and sufficient to merge
    // committed WAL frames so page_count reflects the real logical size.
    try {
      try {
        db.exec("PRAGMA wal_checkpoint(PASSIVE)");
      } catch {
        /* ok if readers block */
      }
      const pageCount =
        (db.prepare("PRAGMA page_count").get() as any)?.page_count ?? 0;
      const pageSize =
        (db.prepare("PRAGMA page_size").get() as any)?.page_size ?? 4096;
      const sizeMb = parseFloat(
        ((pageCount * pageSize) / (1024 * 1024)).toFixed(2),
      );
      if (sizeMb > 0) {
        record("infra.persist.db-size-mb", sizeMb);
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring infra.persist.db-size-mb: ${e}`,
      );
    }

    // I3: infra.messages.delivery-rate — ratio of delivered messages
    try {
      const totalMsgs = count(
        "SELECT COUNT(*) as c FROM notification_messages WHERE sent_at > ?",
        now - 3600000,
      );
      // All messages in notification_messages are delivered (they have sent_at), so rate is 1.0 if any exist
      const failedMsgs = count(
        "SELECT COUNT(*) as c FROM notification_messages WHERE sent_at IS NULL",
      );
      const delivered = totalMsgs;
      const total = totalMsgs + failedMsgs;
      record(
        "infra.messages.delivery-rate",
        total > 0 ? parseFloat((delivered / total).toFixed(4)) : 1.0,
        total,
      );
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring infra.messages.delivery-rate: ${e}`,
      );
    }

    // I4: infra.sessions.active-count — currently running sessions
    try {
      const activeSessions = count(
        "SELECT COUNT(*) as c FROM sessions WHERE status = 'running'",
      );
      record("infra.sessions.active-count", activeSessions);
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring infra.sessions.active-count: ${e}`,
      );
    }

    // ── Structurally-pinned metric detector (KE-938/KE-939/KE-940) ──
    // Counts active metrics (v2.*/capability.*/infra.*) that have only 1
    // distinct snapshot value over 7 days (dv=1) with ≥24 samples, excluding
    // metrics on the guard-metric allow-list (STRUCTURALLY_PINNED_ALLOWLIST).
    try {
      const sevenDays = now - 7 * 86400000;
      const pinnedRows = db
        .prepare(
          `SELECT m.id
         FROM metrics m
         LEFT JOIN metric_snapshots s
           ON s.metric_id = m.id
          AND s.measured_at > ?
         WHERE m.status = 'active'
           AND (m.id LIKE 'v2.%' OR m.id LIKE 'capability.%' OR m.id LIKE 'infra.%')
         GROUP BY m.id
         HAVING COUNT(DISTINCT s.value) = 1 AND COUNT(s.value) >= 24`,
        )
        .all(sevenDays) as Array<{ id: string }>;
      const pinned = pinnedRows.filter(
        (r) => !STRUCTURALLY_PINNED_ALLOWLIST.has(r.id),
      );
      record(
        "metric.structurally-pinned-count",
        pinned.length,
        pinnedRows.length,
      );
      if (pinned.length > 0) {
        ctx.sdk.log(
          "info",
          `[metrics-snapshot] Structurally pinned metrics: ${pinned.map((r) => r.id).join(", ")}`,
        );
      }
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error measuring metric.structurally-pinned-count: ${e}`,
      );
    }

    // ── Generic metrics (source_query / source_command) ──────────────

    const measurable = db
      .prepare(
        "SELECT id, source_query, source_command FROM metrics WHERE status = 'active' AND (source_query IS NOT NULL OR source_command IS NOT NULL)",
      )
      .all() as any[];

    let measured = 0;
    for (const m of measurable) {
      try {
        let value: number | null = null;
        let sampleSize: number | undefined;
        let measuredAt: number | undefined;
        let note: string | undefined;
        if (m.source_query) {
          const row = db.prepare(m.source_query).get() as any;
          if (row) {
            const vals = Object.values(row).filter(
              (v) => typeof v === "number",
            );
            if (vals.length > 0) value = vals[0] as number;
          }
        } else if (m.source_command) {
          const { stdout } = await execAsync(m.source_command, {
            cwd: ctx.sdk.paths.root,
            timeout: 5000,
            maxBuffer: 1024 * 1024,
          });
          const output = stdout.trim();
          try {
            const parsed = JSON.parse(output);
            // Plain number output (e.g. "0" or "42") — JSON.parse succeeds
            // but returns a primitive, not an object with .value
            if (typeof parsed === "number" && Number.isFinite(parsed)) {
              value = parsed;
            } else if (
              parsed &&
              typeof parsed === "object" &&
              typeof parsed.value === "number" &&
              Number.isFinite(parsed.value)
            ) {
              value = parsed.value;
              if (
                typeof parsed.sampleSize === "number" &&
                Number.isFinite(parsed.sampleSize)
              ) {
                sampleSize = parsed.sampleSize;
              }
              if (
                typeof parsed.measuredAt === "number" &&
                Number.isFinite(parsed.measuredAt)
              ) {
                measuredAt = parsed.measuredAt;
              }
              if (typeof parsed.note === "string") {
                note = parsed.note;
              } else if (parsed.note != null) {
                note = JSON.stringify(parsed.note);
              }
            }
          } catch {
            const parsed = parseFloat(output);
            if (!isNaN(parsed)) value = parsed;
          }
        }
        if (value !== null) {
          record(m.id, value, sampleSize, note, measuredAt);
          measured++;
        }
      } catch {
        /* skip individual metric errors */
      }
    }

    // ── Alert lifecycle (type-aware: open on breach, resolve on recovery) ───────

    try {
      metricService.evaluate();
    } catch (e) {
      ctx.sdk.log(
        "info",
        `[metrics-snapshot] Error during alert lifecycle: ${e}`,
      );
    }

    ctx.sdk.log(
      "info",
      `[metrics-snapshot] ${ALL_METRICS.length} built-in metrics recorded, ${measured}/${measurable.length} source-defined`,
    );
  };
};
