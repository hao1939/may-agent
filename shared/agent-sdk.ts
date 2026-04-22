/**
 * Agent SDK — the single import point for infra types.
 *
 * This is the ONLY file in agents/ that references src/lib/.
 * All handlers, workflows, and shared code import types from here.
 * If infra restructures, only this file needs updating.
 */

// ── Handler / Cron types ──────────────────────────────────────────────
export type {
  HandlerContext,
  HandlerModule,
  TriggerEvent,
  RuntimeCtx,
} from "../../src/lib/handler-context.js";

export type {
  CronEntry,
  PreflightCheck,
} from "../../src/lib/cron-tool.js";

// ── Database ──────────────────────────────────────────────────────────
export type { SqliteDb } from "../../src/lib/db.js";

// ── Manager ───────────────────────────────────────────────────────────
export type { SubagentManager } from "../../src/lib/manager.js";

// ── Persistence ───────────────────────────────────────────────────────
export type {
  PersistedSession,
  WorkflowRun,
  WorkflowStep,
} from "../../src/lib/persistence.js";

// ── Workflow ──────────────────────────────────────────────────────────
export type {
  WorkflowContext,
  WorkflowModule,
  WorkflowResult,
  WorkflowEvent,
} from "../../src/lib/workflow.js";

// ── Misc ──────────────────────────────────────────────────────────────
export type { TaskResult } from "../../src/lib/types.js";

// ── Growth (agent forking/promotion) ─────────────────────────────────
export {
  forkAgent,
  promoteAgent,
  discardAgent,
  listLabAgents,
} from "../../src/lib/growth.js";
export type { GrowthConfig } from "../../src/lib/growth.js";
