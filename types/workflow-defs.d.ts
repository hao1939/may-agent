/**
 * Type declarations for the may-agent workflow runtime.
 * These types are provided by the compiled runtime at /app/src/lib/.
 * This file provides type-checking for agents/ code without requiring the runtime source.
 */

// ── Workflow types ───────────────────────────────────────────────────

interface WorkflowContext {
  agentsRoot?: string;
  getDb(): unknown;
  agent: string;
  sessionId?: string;
  task?: string;
  cache?: Record<string, unknown>;
  projectRoot?: string;
  projectFile?: string;
  journalFile?: string;
  discussionFile?: string;
  emit(...args: any[]): void;
  log(...args: any[]): void;
  done(...args: any[]): WorkflowResult;
  runAgent(task: string, ...args: any[]): Promise<TaskResult>;
  summarize(...args: any[]): Promise<string>;
  escalate(...args: any[]): WorkflowResult;
  createSession?(...args: any[]): unknown;
  dispatchEvent?(...args: any[]): void;
  [key: string]: unknown;
}

interface WorkflowResult {
  status: "success" | "failure" | "partial" | "blocked";
  summary: string;
  [key: string]: unknown;
}

interface TaskResult {
  status: string;
  output?: string;
  [key: string]: unknown;
}

// ── Guard types ──────────────────────────────────────────────────────

interface Demand {
  type: "block" | "warn" | "inject" | "run_step";
  reason: string;
  [key: string]: unknown;
}

interface WorkflowGuardEvent {
  type: string;
  source?: string;
  step: string;
  result: {
    lastAssistantText?: string;
    messages: unknown[];
    turnsUsed?: number;
    finishResult?: { status?: string; deliverables?: Array<{ path: string; description?: string }>; [key: string]: unknown };
    [key: string]: unknown;
  };
  completedSteps?: Array<{ result?: { turnsUsed?: number; [key: string]: unknown }; [key: string]: unknown }>;
  task?: string;
  [key: string]: unknown;
}

interface WorkflowGuard {
  name: string;
  events?: string[];
  handle(event: WorkflowGuardEvent): Demand[];
}
