import type {
  AppInputContext,
  AppConversationRequest,
  ConversationTurnResult,
  TSchema,
  AppDefinition,
  AppRead,
  TaskAttempt,
  TaskVerifier,
} from "@may-agent/sdk";
import type { TaskBinding } from "../../../lib/persistence.js";
import type { ConversationContextQuery } from "../state/conversations.js";
import type { ConversationRequestChange } from "../state/conversation-requests.js";
import type { EventEnvelope } from "../events/bus.js";
import type { AppTaskEvents } from "./app-task-emitter.js";
import type { AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type { AppTaskChildContext, AppTaskClaim, AppTaskLiveSnapshot } from "./app-task-reconciler.js";
import type { appDependencyCatalog } from "../../app-dependency-catalog.js";
import type { TaskCapabilityRun } from "./result.js";
import type { AppTaskAttempt } from "./app-task-state.js";
import type { AppTaskContext } from "./app-task-store.js";
import type { ConversationTaskAppResolver, ConversationTaskProposal } from "../state/conversation-task-turns.js";
import type { AppRegistrySnapshot } from "../apps/registry.js";

/** Model execution receives data and scoped capabilities, never a Task store or claim. */
export type AppInputResolver = (input: {
  app: Readonly<AppDefinition>;
  inputContext: Readonly<AppInputContext>;
  execution: {
    outputSchema: TSchema;
    readContext: (query: ConversationContextQuery) => unknown;
    signal: AbortSignal;
    sessionStarted: (sessionId: string) => void;
    taskBinding: TaskBinding;
    updateRequest?: (change: ConversationRequestChange, operationId: string) => AppConversationRequest;
  };
}) => Promise<ConversationTurnResult>;

/** Host composition hook: wires context and model capabilities; runtime retains settlement. */
export type TaskConversationRunner = {
  execute(input: {
    config: AppTaskContext;
    claim: AppTaskClaim;
    app: Readonly<AppDefinition>;
    registry: AppRegistrySnapshot;
    signal: AbortSignal;
    execution: Pick<
      TaskExecutionInput,
      "descriptor" | "attempt" | "executionPaths" | "taskEvents" | "taskRead" | "taskSnapshot"
    >;
    getTaskApp: ConversationTaskAppResolver;
  }): Promise<ConversationTaskProposal>;
  snapshot?(): TaskConversationRunner;
};

/** Read-only App declaration, never its mutable Task store. */
export type TaskExecutionApp = { id: string; appDir: string; projectDir: string; app: AppDefinition };

/** Attempt owns identity, desired work and outputs; the rest is Host-only execution context. */
export type TaskExecutionInput = {
  descriptor: TaskExecutionApp;
  attempt: TaskAttempt;
  executionPaths: AppTaskExecutionPaths;
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  fallbackReason?: string;
  taskEvents: AppTaskEvents;
  taskRead: AppRead["tasks"];
  taskSnapshot: AppTaskLiveSnapshot;
};

/** Resolved for one claim; workspace selection precedes the shared invocation. */
export type PreparedTaskExecutor = {
  workspace: "shared" | "task" | { kind: "task"; baseBranch: string };
  execute(input: TaskExecutionInput): Promise<TaskCapabilityRun>;
};

export type TaskAgentInput = TaskExecutionInput & {
  executionTimeoutMs: number;
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
  workspace: PreparedTaskExecutor["workspace"];
  verifier?: { name: string; sourcePath: string; verify: TaskVerifier };
};

export type TaskWorkflowInput = TaskExecutionInput & {
  source: TaskDefinitionSource;
  workflow: string;
  executionTimeoutMs: number;
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
  /** Returns true only after the durable session projection was reconciled. */
  interrupt(sessionId: string, reason: string, taskId?: string): boolean;
  workflowInterrupted(workflowRunId: string | null): boolean;
};
