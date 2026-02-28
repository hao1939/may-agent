/**
 * Workflow type definitions.
 *
 * Workflow .ts files should reference this file for type checking:
 *   /// <reference path="../../../src/workflow-defs.d.ts" />
 *
 * Or place a tsconfig.json in the workflows/ directory that includes it.
 */

/** Result from running a sub-agent. */
interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  duration: string;
  outputDir: string;
  error?: string;
}

/** Workflow event types for observability. */
type WorkflowEvent =
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "step_start"; step: string; sessionId?: string }
  | { type: "step_done"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow_done"; summary: string }
  | { type: "workflow_escalate"; reason: string };

/** Workflow result — either done or escalated to slow mode. */
type WorkflowResult =
  | { type: "done"; summary: string }
  | { type: "escalate"; reason: string; context?: unknown };

/** Context provided to workflow execute() functions. */
interface WorkflowContext {
  /** The original task. */
  task: string;

  /** Run a sub-agent, wait for it to finish, return result. */
  runAgent(name: string, task: string): Promise<TaskResult>;

  /** Run a sub-workflow by name. Enables workflow composition. */
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;

  /** Emit a workflow event (observable by subscribers). */
  emit(event: WorkflowEvent): void;

  /** Mark workflow as done. */
  done(summary: string): WorkflowResult;

  /** Escalate — workflow can't handle this, return to agent (slow mode). */
  escalate(reason: string, context?: unknown): WorkflowResult;
}
