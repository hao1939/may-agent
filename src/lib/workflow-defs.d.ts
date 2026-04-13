/**
 * Ambient type definitions for workflow .ts files.
 *
 * Workflow files reference this for type checking:
 *   /// <reference path="../../../src/workflow-defs.d.ts" />
 *
 * IMPORTANT: These types must stay in sync with their source of truth:
 *   - TaskResult        → src/types.ts
 *   - WorkflowEvent     → src/workflow.ts
 *   - WorkflowResult    → src/workflow.ts
 *   - WorkflowContext   → src/workflow.ts
 *   - HandoffOptions    → src/handoff.ts
 */

/** Result from running a sub-agent. */
interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  messages: any[];
  duration: string;
  outputDir: string;
  error?: string;
  /** Number of assistant turns completed in this session. */
  turnsUsed?: number;
}

/** Workflow event types for observability. */
type WorkflowEvent =
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "step_start"; step: string; sessionId?: string }
  | { type: "step_done"; step: string; sessionId?: string; result: TaskResult }
  | { type: "workflow_done"; summary: string }
  | { type: "workflow_escalate"; reason: string };

/** Workflow result — either done or escalated to slow mode. */
type WorkflowResult = { type: "done"; summary: string } | { type: "escalate"; reason: string; context?: unknown };

/** Options for customizing the handoff summary. */
interface HandoffOptions {
  /** Include the agent's final response text. Default: true. */
  includeResponse?: boolean;
  /** Include key facts (files read/written, exec commands). Default: true. */
  includeKeyFacts?: boolean;
  /** Include error summaries. Default: true. */
  includeErrors?: boolean;
  /** Include file content previews for written files. Default: false. */
  includeWriteContents?: boolean;
  /** Maximum total length of the handoff summary. Default: 8000. */
  maxLength?: number;
}

/** Context provided to workflow execute() functions. */
interface WorkflowContext {
  /** The original task. */
  task: string;

  /** The name of the agent that called this workflow.
   *  Use this instead of hardcoding agent names in shared workflows. */
  agent: string;

  /** Run a sub-agent, wait for it to finish, return result. */
  runAgent(name: string, task: string): Promise<TaskResult>;

  /** Run a sub-workflow by name. Enables workflow composition. */
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;

  /** Emit a workflow event (observable by subscribers). */
  emit(event: WorkflowEvent): void;

  /**
   * Build a rich context summary from a completed TaskResult for step handoff.
   *
   * Instead of passing just `result.lastAssistantText` to the next step,
   * use this to give it structured context about files modified, commands run,
   * errors encountered, and the agent's final assessment.
   *
   * Example:
   * ```ts
   * const coder = await ctx.runAgent("coder", ctx.task);
   * const reviewTask = `Review this implementation.\n\n` +
   *   `## Task\n${ctx.task}\n\n` +
   *   `## Implementation Summary\n${ctx.summarize(coder)}`;
   * const review = await ctx.runAgent("reviewer", reviewTask);
   * ```
   */
  summarize(result: TaskResult, opts?: HandoffOptions): string;

  /** Mark workflow as done. */
  done(summary: string): WorkflowResult;

  /** Escalate — workflow can't handle this, return to agent (slow mode). */
  escalate(reason: string, context?: unknown): WorkflowResult;
}
