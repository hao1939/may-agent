import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "../../../may-agent/packages/sdk/src/index.js";
import { buildResultWait } from "./observers.js";

type Input = { resource: string };
export const name = "observation-smoke";
export const description =
  "Verify that an installed build observer can resume an ordinary Task.";

// Install this in the owning agent's workflows and assign an ordinary Task
// with workflow: "observation-smoke", input: { resource: <known finished build> }.
export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  const attempt = ctx.reconciliation;
  if (!attempt || typeof ctx.input?.resource !== "string" || !ctx.input.resource.trim()) {
    return ctx.blocked(
      "Run as a Task with the reference of a safe, known finished build",
    );
  }
  const wait = await buildResultWait(
    ctx.read,
    ctx.input.resource,
    `observation-smoke:${attempt.taskId}`,
  );
  const { source } = wait.expected as Record<string, unknown>;
  const evidence = attempt.events.items.find(
    (item) =>
      item.event.type === wait.type &&
      item.event.source === source &&
      item.event.data.resource === ctx.input.resource &&
      ["passed", "failed", "cancelled"].includes(
        String(item.event.data.state),
      ) &&
      Number.isSafeInteger(item.eventId) &&
      item.eventId! > 0,
  );
  if (
    attempt.previousAttempt?.acceptedResult?.state === "waiting" &&
    evidence &&
    attempt.task.conditions.some(
      (condition) =>
        condition.id === wait.id &&
        condition.subject === wait.subject &&
        condition.observation?.state === "true",
    )
  ) {
    // A terminal failure still proves observation worked. It is not build success.
    const summary = "A durable observation reached a later owner attempt";
    return ctx.done(summary, {
      state: "converged",
      summary,
      facts: [`event:${evidence.eventId}`],
      result: {
        appId: attempt.appId,
        taskId: attempt.taskId,
        resource: ctx.input.resource,
        source: evidence.event.source,
        eventId: evidence.eventId,
        providerObservedAt: evidence.event.data.observedAt ?? null,
        deliveredAt: evidence.observedAt,
        waitingAttemptId: attempt.previousAttempt.attemptId,
      },
    } satisfies TaskReconcileResult);
  }
  const summary =
    "Observation path is unverified; waiting for the installed detector";
  return ctx.done(summary, {
    state: "waiting",
    summary,
    facts: [wait.subject],
    conditions: [wait],
    report: true,
  } satisfies TaskReconcileResult);
}
