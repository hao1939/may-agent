import type { AppDefinition, AppRead, TaskAttempt, TaskVerifier } from "@may-agent/sdk";
import type { EventEnvelope } from "../events/bus.js";
import type { AppTaskEvents } from "./app-task-emitter.js";
import type { AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type { AppTaskChildContext, AppTaskClaim, AppTaskLiveSnapshot } from "./app-task-reconciler.js";
import type { appDependencyCatalog } from "../../app-dependency-catalog.js";
import type { TaskCapabilityRun } from "./result.js";
import type { AppTaskAttempt } from "./app-task-state.js";
import type { AppTaskContext } from "./app-task-store.js";
import type { ConversationTaskProposal } from "../state/conversation-task-turns.js";
import type { AppRegistrySnapshot } from "../apps/registry.js";

/** Conversation-specific judgment, using the common Task attempt and settlement. */
export type TaskConversationRunner = {
  execute(input: {
    config: AppTaskContext;
    claim: AppTaskClaim;
    app: Readonly<AppDefinition>;
    registry: AppRegistrySnapshot;
    signal: AbortSignal;
    getTaskApp(appId: string): { app: Readonly<AppDefinition>; config: AppTaskContext };
  }): Promise<ConversationTaskProposal>;
  snapshot?(): TaskConversationRunner;
};

/** Read-only App declaration, never its mutable Task store. */
export type TaskExecutionApp = { id: string; appDir: string; projectDir: string; app: AppDefinition };

/** Attempt owns identity, desired work and outputs; the rest is Host-only execution context. */
type TaskExecutionInput = {
  descriptor: TaskExecutionApp;
  attempt: TaskAttempt;
  defaultParentId: string;
  executionPaths: AppTaskExecutionPaths;
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  fallbackReason?: string;
  observer?: AppTaskExecutionObserver;
  executionTimeoutMs: number;
};

export type TaskAgentInput = TaskExecutionInput & {
  dependencies: ReturnType<typeof appDependencyCatalog>;
  sessionStarted(sessionId: string): void;
};

/** Agent-specific preparation and execution; no claim or result authority. */
export type TaskAgentRunner = {
  prepare(input: { source: TaskDefinitionSource; appDir: string; agent: string }): Promise<boolean>;
  available(agent: string): boolean;
  role(agent: string): TaskAttempt["role"];
  execute(input: TaskAgentInput): Promise<TaskCapabilityRun>;
  /** Pin agent definitions at the synchronous App publication boundary. */
  snapshot(): TaskAgentRunner;
};

export type AppTaskExecutionObserver = {
  providerStarted(promptBytes: number): void;
  providerFinished(): void;
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
  source: TaskDefinitionSource;
  taskEvents: AppTaskEvents;
  capability: WorkflowCapability;
  /** Actual selected handler, including workflow-to-agent recovery decisions. */
  handler: string;
  taskSnapshot: AppTaskLiveSnapshot;
  taskRead: AppRead["tasks"];
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

export type TaskSessionRecovery = {
  handoff(attempt: AppTaskAttempt | undefined): AppTaskClaim["handoff"];
  read(sessionId: string): { status: string; taskBinding?: unknown; workflowRunId?: string } | null;
  isLive(sessionId: string): boolean;
  lastActivityAt(sessionId: string): number | null;
  result(sessionId: string): unknown;
  interrupt(sessionId: string, reason: string, taskId?: string): void;
  workflowInterrupted(workflowRunId: string | null): boolean;
};
