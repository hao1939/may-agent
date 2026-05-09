/**
 * sdk.ts — Agent SDK interface (pure types, zero runtime code)
 *
 * The canonical capability surface of the may-agent system.
 * Agent tools, handlers, workflows, and gym runners all go through this.
 *
 * Design: agents/shared/may-agent-docs/sdk.md
 */

import type { SqliteDb } from "./db.js";
import type { MetricService } from "./metrics.js";

// ── Core SDK ──────────────────────────────────────────────────────────

export interface AgentSDK {
  /** Run an agent on a task and wait for its result. */
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;

  /** Run a named workflow synchronously. Returns when workflow completes. */
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult>;

  /** Reserved for future raw LLM sessions. Currently not implemented by sdk-impl.ts. */
  createLLMSession(opts: SessionOpts): Promise<SessionHandle>;

  /** Emit a typed event (persisted to events table). */
  emit(type: string, data?: Record<string, unknown>): void;

  /** Access the shared database. */
  getDb(): SqliteDb;

  /** Define, record, evaluate, and inspect system metrics. */
  metrics: MetricService;

  /** Log a diagnostic message. */
  log(level: "info" | "warn" | "error", msg: string): void;

  /** Send an async message to a target. "human" → Telegram/web. Agent name → agent inbox. */
  message(target: string, content: string): void;

  /** Escalate to a target — I'm stuck, need help. Enters escalation chain, may trigger immediate wake. */
  escalate(target: string, reason: string): void;

  /** System paths. */
  paths: {
    persist: string;   // .state directory (DB, logs)
    root: string;      // project root
    agents: string;    // agents/ directory
  };
}

// ── Workflow SDK ───────────────────────────────────────────────────────

export interface WorkflowSDK extends AgentSDK {
  /** The task this workflow was invoked with. */
  task: string;
  /** The agent this workflow runs as. */
  agent: string;

  /** Terminate the workflow successfully. */
  done(summary: string, opts?: DoneOpts): WorkflowResult;
  // Note: escalate() inherited from AgentSDK.
  // In workflow context, escalate(target, reason) also terminates the workflow.
}

// ── Supporting types ──────────────────────────────────────────────────

export interface RunOpts {
  source?: string;
  projectId?: string;
  timeout?: number;
}

export interface SessionOpts {
  systemPrompt: string;
  tools: "full" | "readonly";
  label?: string;
}

export interface SessionHandle {
  prompt(message: string): Promise<string>;
  lastText(): string;
  close(): void;
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
  status: "done" | "escalated";
  summary: string;
}
