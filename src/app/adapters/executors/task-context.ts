import type { TaskAgentInput } from "../../core/tasks/execution.js";
import type { TaskExecutionContext } from "../../../lib/task-execution-context.js";
import type { SubagentDefinition } from "../../../lib/types.js";
import { APP_TASK_RECOVERY_OWNER } from "../../core/tasks/session-binding.js";

/** Both entry points expose the same owning Task and fenced capabilities. */
export function taskExecutionContext(
  input: Pick<TaskAgentInput, "descriptor" | "attempt" | "executionPaths" | "taskEvents" | "taskRead" | "taskSnapshot"> & Partial<Pick<TaskAgentInput, "dependencies">>,
  definitions?: ReadonlyMap<string, SubagentDefinition>,
): TaskExecutionContext {
  const { attempt, descriptor } = input;
  const task = attempt.task;
  return {
    taskBinding: { appId: descriptor.id, taskId: task.id, generation: task.generation, attemptId: attempt.attemptId },
    recoveryOwner: APP_TASK_RECOVERY_OWNER,
    executionPaths: input.executionPaths,
    agentDefinitions: definitions,
    taskEmitter: input.taskEvents,
    observeEvents: attempt.onEvent,
    taskRead: input.taskRead,
    details: { task, declaredOutputs: attempt.declaredOutputPaths, ...(input.dependencies ? { dependencies: input.dependencies } : {}) },
    reconciliation: {
      appId: descriptor.id,
      taskId: task.id,
      generation: task.generation,
      resourceVersion: attempt.resourceVersion,
      agent: attempt.role.agent,
      owner: attempt.role.agent,
      outcome: task.outcome,
      acceptance: task.acceptance,
      input: task.input ?? {},
      waits: structuredClone(attempt.waits),
      children: structuredClone(attempt.children),
      taskSnapshot: {
        live: (input.taskSnapshot?.live ?? []).map(({ phase, ...item }) => ({
          ...item,
          status: phase === "converged" ? "done" : phase,
        })),
        truncated: input.taskSnapshot?.truncated ?? false,
      },
      events: attempt.events,
      ...(attempt.previousAttempt ? { previousAttempt: attempt.previousAttempt } : {}),
    },
  };
}
