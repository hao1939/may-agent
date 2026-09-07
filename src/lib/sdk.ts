/**
 * Host-internal capabilities for maintenance handlers (pure types).
 *
 * App definitions and bounded workflows use @may-agent/sdk. This interface
 * includes Host storage and execution internals and is not the public App SDK.
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

// ── Supporting types ──────────────────────────────────────────────────

export interface RunOpts {
  source?: string;
  /** Session classification for agent steps started by a workflow. */
  sessionSource?: string;
  projectId?: string;
  /** Structured workflow input; never encode control data into task prose. */
  input?: unknown;
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
  resumeCondition?: string;
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

export interface WorkflowResult {
  status: "done" | "blocked";
  summary: string;
  runId?: string;
}
