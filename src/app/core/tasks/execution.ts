import type { AppDefinition, TaskAttempt, TaskVerifier } from "@may-agent/sdk";
import type { ExecutionRecipient } from "../../../lib/execution-recipient.js";
import type { TaskBinding } from "../../../lib/persistence.js";
import type { appDependencyCatalog } from "../../app-dependency-catalog.js";
import type { EventEnvelope } from "../events/bus.js";
import type { AppTaskEvents } from "./app-task-emitter.js";
import type { AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type { AppTaskChildContext, AppTaskLiveSnapshot } from "./app-task-reconciler.js";
import type { TaskCapabilityRun } from "./result.js";

/** Read-only App declaration, never its mutable Task store. */
export type TaskExecutionApp = { id: string; appDir: string; projectDir: string; app: AppDefinition };

/** Attempt owns identity, desired work and outputs; the rest is Host-only execution context. */
type TaskExecutionInput = {
  descriptor: TaskExecutionApp;
  attempt: TaskAttempt;
  executionPaths: AppTaskExecutionPaths;
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  executionTimeoutMs: number;
};

export type TaskAgentInput = TaskExecutionInput & {
  validateResult?: (result: import("@may-agent/sdk").TaskReconcileResult) => string | null;
  taskEvents: AppTaskEvents;
  taskSnapshot: AppTaskLiveSnapshot;
  dependencies: ReturnType<typeof appDependencyCatalog>;
  sessionStarted(sessionId: string): void;
};

/** Agent-specific preparation and execution; no claim or result authority. */
export type TaskAgentRunner = {
  prepare(input: { source: TaskDefinitionSource; appDir: string; agent: string }): Promise<boolean>;
  available(agent: string): boolean;
  /** Same pinned definition used for execution; unknown is never an alias key. */
  executionRecipient?(agent: string): ExecutionRecipient | null;
  role(agent: string): TaskAttempt["role"];
  execute(input: TaskAgentInput): Promise<TaskCapabilityRun>;
  /** Pin agent definitions at the synchronous App publication boundary. */
  snapshot(): TaskAgentRunner;
};

export type WorkflowCapability = {
  workflow: string;
  agent?: string;
  task: string;
};

/** Immutable definition roots selected by composition, not the mutable checkout. */
export type TaskDefinitionSource = {
  projectsRoot: string;
  projectRoot: string;
  persistDir?: string;
  agentsRoot?: string;
  sharedRoot?: string;
};

export type TaskWorkflowInspection = {
  available: boolean;
  error: string | null;
  workspace: "shared" | "task" | { kind: "task"; baseBranch: string };
  verifier?: { name: string; sourcePath: string; verify: TaskVerifier };
};

export type TaskWorkflowInput = TaskExecutionInput & {
  /** Host ceiling that a workflow declaration cannot extend. */
  executionTimeoutLimitMs?: number;
  source: TaskDefinitionSource;
  taskEvents: AppTaskEvents;
  capability: WorkflowCapability;
  /** Actual selected handler, including workflow-to-agent recovery decisions. */
  handler: string;
  taskSnapshot: AppTaskLiveSnapshot;
};

/** Host-private workflow capability. It proposes results; core owns admission. */
export type TaskWorkflowRunner = {
  inspect(input: {
    source: TaskDefinitionSource;
    appDir: string;
    agent: string;
    workflow: string;
  }): Promise<TaskWorkflowInspection>;
  execute(input: TaskWorkflowInput): Promise<TaskCapabilityRun>;
  /** Built-ins pin their nested agent definitions at publication, when needed. */
  snapshot?(): TaskWorkflowRunner;
};

/** Unified Task execution runner covering both prompt agents and code workflows. */
export type TaskRunner = Omit<TaskAgentRunner, "snapshot"> & {
  inspect: TaskWorkflowRunner["inspect"];
  executeWorkflow: TaskWorkflowRunner["execute"];
  snapshot(): TaskRunner;
};

export type TaskSessionRecovery = {
  read(sessionId: string): { status: string; taskBinding?: unknown; workflowRunId?: string } | null;
  isLive(sessionId: string): boolean;
  lastActivityAt(sessionId: string): number | null;
  /** Confirms the required shutdown and durable reconciliation for this session.
   * False or an error leaves recovery unconfirmed;
   * callers must retain ownership. This does not release or requeue the Task. */
  interrupt(
    sessionId: string,
    reason: string,
    taskId?: string,
    expectedBinding?: TaskBinding,
  ): boolean;
  workflowInterrupted(workflowRunId: string | null): boolean;
};
