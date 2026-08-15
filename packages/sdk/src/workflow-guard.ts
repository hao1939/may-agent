/**
 * Stable, type-only contract for workflow guards.
 *
 * Guards inspect local workflow lifecycle callbacks. They do not receive App
 * inbox events and cannot mutate App or task state directly.
 */

export type WorkflowGuardStepResult = {
  sessionId: string;
  status: "done" | "error" | "interrupted";
  lastAssistantText: string | null;
  messages: unknown[];
  duration: string;
  outputDir: string;
  error?: string;
  errorMessage?: string;
  turnsUsed?: number;
  finishResult?: {
    status: "success" | "failure" | "blocked" | "partial";
    summary: string;
    deliverables?: { path: string; description: string }[];
    blockers?: { reason: string; context: string }[];
    next_steps?: string;
    result?: unknown;
  };
  structuredResult?: unknown;
};

export type WorkflowGuardCompletedStep<
  TResult extends WorkflowGuardStepResult = WorkflowGuardStepResult,
> = {
  step: string;
  sessionId?: string;
  result: TResult;
};

/** Local workflow callbacks available to pure workflow guards. */
export type WorkflowGuardEvent<
  TResult extends WorkflowGuardStepResult = WorkflowGuardStepResult,
> =
  | {
      type: "step_done";
      source: "agent" | "function";
      step: string;
      sessionId?: string;
      result: TResult;
      completedSteps: WorkflowGuardCompletedStep<TResult>[];
      task: string;
    }
  | {
      type: "step_start";
      source: "agent" | "function";
      step: string;
      task: string;
      completedSteps: WorkflowGuardCompletedStep<TResult>[];
    }
  | { type: "workflow_start"; workflow: string; task: string }
  | {
      type: "workflow_done";
      workflow: string;
      summary: string;
      completedSteps: WorkflowGuardCompletedStep<TResult>[];
    };

/** A bounded request from a guard to the workflow engine. */
export type Demand = {
  type: "observe" | "repair" | "run_step" | "block" | "warn";
  reason: string;
  guardName?: string;
  step?: {
    agent: string;
    task: string;
    label?: string;
  };
};

/** Pure workflow policy: callback in, bounded demands out. */
export type WorkflowGuard<
  TResult extends WorkflowGuardStepResult = WorkflowGuardStepResult,
> = {
  name: string;
  events?: WorkflowGuardEvent<TResult>["type"][];
  costTier?: "zero" | "low" | "medium";
  handle(event: WorkflowGuardEvent<TResult>): Demand[];
};

export type GuardModule<
  TResult extends WorkflowGuardStepResult = WorkflowGuardStepResult,
> = {
  guard: WorkflowGuard<TResult>;
};
