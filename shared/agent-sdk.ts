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
export type {
  QueryAPI,
  QueryResult,
  QueryOptions,
  SessionQuery,
  EventQuery,
  MetricQuery,
  AlertQuery,
  ProjectQuery,
} from "../../src/lib/query-service.js";
export { createWorkflowHandler } from "./lib/workflow-handler.ts";
export type { WorkflowHandlerOptions } from "./lib/workflow-handler.ts";

// ── Handler / Cron types ──────────────────────────────────────────────
export type {
  HandlerContext,
  HandlerModule,
  TriggerEvent,
} from "../../src/lib/handler-context.js";

export type {
  CronEntry,
  PreflightCheck,
} from "../../src/lib/cron-tool.js";

// ── Database ──────────────────────────────────────────────────────────
export type { SqliteDb } from "../../src/lib/db.js";

// ── Manager (inline — src/lib/manager.ts no longer on disk) ──────────
export interface SubagentManager {
  registryStore: {
    getRegistry(): { sessions: Record<string, PersistedSession> };
  };
  run(agent: string, task: string, opts?: Record<string, unknown>): string;
  waitFor(sessionId: string): Promise<{
    sessionId: string;
    status?: string;
    lastAssistantText?: string | null;
    messages?: unknown[];
    [key: string]: unknown;
  }>;
  callAgent(agent: string, task: string, opts?: Record<string, unknown>): Promise<{
    sessionId: string;
    status?: string;
    lastAssistantText?: string;
    messages?: unknown[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ── Persistence (inline — src/lib/persistence.ts no longer on disk) ──
export interface PersistedSession {
  sessionId?: string;
  agent: string;
  status: string;
  parentSessionId?: string;
  task?: string;
  startedAt?: number;
  endedAt?: number;
  [key: string]: unknown;
}

// ── Workflow types (inline — src/lib/workflow-tool.ts no longer on disk)
export interface WorkflowStep {
  sessionId: string;
  agent: string;
  status: string;
}
export interface WorkflowRun {
  runId: string;
  workflow: string;
  task: string;
  parentSessionId?: string;
  startedAt: number;
  endedAt?: number;
  status: string;
  steps: WorkflowStep[];
  error?: string;
}

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
