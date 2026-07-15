/**
 * sdk.ts — Agent SDK interface (pure types, zero runtime code)
 *
 * The canonical capability surface of the may-agent system.
 * Agent tools, handlers, workflows, and gym runners all go through this.
 *
 * Design: shared/may-agent-docs/sdk.md
 */

import type { SqliteDb } from "./db.js";
import type { MetricService } from "./metrics.js";
import type { QueryAPI } from "./query-service.js";
import type { CommandAPI } from "./command-service.js";

// ── Core SDK ──────────────────────────────────────────────────────────

export interface AgentSDK {
  /** Run an agent on a task and wait for its result. */
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;

  /** Run a named workflow synchronously. Returns when workflow completes. */
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult>;

  /** Emit a typed event (persisted to events table). */
  emit(type: string, data?: Record<string, unknown>, envelope?: EventEnvelopeOptions): void;

  /** Access the shared database. */
  getDb(): SqliteDb;

  /** Read bounded runtime facts without opening SQLite directly. */
  query: QueryAPI;

  /** Execute typed state changes through durable events. */
  commands: CommandAPI;

  /** Define, record, evaluate, and inspect system metrics. */
  metrics: MetricService;

  /** Log a diagnostic message. */
  log(level: "info" | "warn" | "error", msg: string): void;

  /** Send an async message to a target. "human" → Telegram/web. Agent name → agent inbox. */
  message(target: string, content: string): void;

  /** External escalation. Defaults to owner agent:may. */
  escalate(reason: string, opts?: EscalationOptions): EscalationRef;

  /** System paths. */
  paths: {
    persist: string; // .state directory (DB, logs)
    root: string; // project root
    agents: string; // agents/ directory
    shared: string; // shared conventions, guards, docs
    projects: string; // first-class projects directory
  };
}

// ── Workflow SDK ───────────────────────────────────────────────────────

export type WorkflowSDK = Omit<AgentSDK, "escalate"> & {
  /** The task this workflow was invoked with. */
  task: string;
  /** The agent this workflow runs as. */
  agent: string;

  /** Terminate the workflow successfully. */
  done(summary: string, opts?: DoneOpts): WorkflowResult;
  /** Terminate this local workflow as blocked; does not emit escalation.created. */
  blocked(reason: string, context?: unknown): WorkflowResult;
};

// ── Supporting types ──────────────────────────────────────────────────

export interface RunOpts {
  source?: string;
  projectId?: string;
  timeout?: number;
}

export interface EventEnvelopeOptions {
  owner?: string;
  source?: string;
  target?: Record<string, unknown>;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  visibility?: "default" | "detail";
  trace?: {
    traceId: string;
    parentEventId?: number;
    links?: Array<{ eventId: number; type?: "reference" | "closure"; label?: string }>;
  };
}

export interface EscalationOptions extends EventEnvelopeOptions {
  requestedAction?: string;
  evidence?: Record<string, unknown>;
  severity?: "P0" | "P1" | "P2" | "P3";
  projectId?: string;
  sourceSessionId?: string;
  resume?: Record<string, unknown>;
  dedupKey?: string;
}

export interface EscalationRef {
  /** Canonical identity of the persisted escalation.created event. */
  eventId: number;
  /** Temporary key for compatibility with legacy producers and stored rows. */
  compatibilityId: string;
}

export interface TaskResult {
  sessionId: string;
  status: string;
  lastAssistantText: string;
}

export interface DoneOpts {
  deliverables?: Deliverable[];
  contextUpdates?: string[];
  nextSteps?: string[];
}

export interface Deliverable {
  path: string;
  description?: string;
}

export interface WorkflowResult {
  status: "done" | "blocked";
  summary: string;
  runId?: string;
}
