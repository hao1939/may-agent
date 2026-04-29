/**
 * Agent SDK — the single import point for infra types.
 *
 * This is the ONLY file in agents/ that references src/lib/.
 * All handlers, workflows, and shared code import types from here.
 * If infra restructures, only this file needs updating.
 */

// ── Agent SDK (canonical interface) ──────────────────────────────────
export type {
  AgentSDK,
  WorkflowSDK,
  RunOpts,
  SessionOpts,
  SessionHandle as SDKSessionHandle,
  TaskResult as SDKTaskResult,
  DoneOpts,
  Deliverable,
  WorkflowResult as SDKWorkflowResult,
} from "../../src/lib/sdk.js";

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
} from "../../src/lib/persistence.js";

// ── Workflow types (in-memory, used by workflow-tool) ──────────────────
export type { WorkflowRun, WorkflowStep } from "../../src/lib/workflow-tool.js";

// ── Workflow ──────────────────────────────────────────────────────────
export type {
  WorkflowContext,
  WorkflowModule,
  WorkflowResult,
  WorkflowEvent,
  SessionOptions,
  SessionHandle,
} from "../../src/lib/workflow.js";

// ── Misc ──────────────────────────────────────────────────────────────
export type { TaskResult } from "../../src/lib/types.js";

// ── Growth (agent forking/promotion) ─────────────────────────────────
export {
  forkAgent,
  promoteAgent,
  discardAgent,
  listLabAgents,
} from "./lib/growth.js";
export type { GrowthConfig } from "./lib/growth.js";

// ── Convention Guards (violation prevention) ──────────────────────────
// EditGuard removed — module no longer exists in compiled runtime (2026-04-28)
// path-guard removed — module no longer exists in compiled runtime (2026-04-28)

export {
  validateFinishDeliverables,
  enforceFinishDeliverables,
  validateVerificationEvidence,
  enforceVerificationEvidence,
} from "./guards/finish-guard.js";
export type {
  FinishDeliverable,
  FinishCallParams,
  FinishValidationResult,
  EvidenceValidationResult,
} from "./guards/finish-guard.js";
