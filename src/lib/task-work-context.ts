import type { TaskAttempt, TaskDetail, TaskReconciliationEvents } from "@may-agent/sdk/app";

/** Disposable facts for presentation, never a scheduler or a judgment of useful progress. */
export function taskWorkContext(
  task: TaskDetail,
  events: TaskReconciliationEvents,
  previous?: TaskAttempt["previousAttempt"],
) {
  const obligations = task.currentObligations;
  const result = previous?.acceptedResult;
  return {
    taskStatus: task.status,
    assignedAtStart: {
      newEvents: events.items.length,
      continuingInputs: events.continuedInputs?.length ?? 0,
      moreEvents: events.truncated,
    },
    retainedInputs: obligations?.available
      ? {
          available: true,
          observed: obligations.inputWaits.items.length,
          pendingWork: obligations.inputWaits.items.filter((item) => item.pending).length,
          truncated: obligations.inputWaits.truncated,
        }
      : { available: false },
    ...(previous
      ? {
          previousResult: {
            attemptId: previous.attemptId,
            generation: previous.generation,
            executionState: previous.state,
            ...(result
              ? {
                  state: result.state,
                  coveredInputs: result.inputKeys?.length ?? null,
                  ...(result.continue ? { continue: true } : {}),
                  ...(result.reviewAt !== undefined ? { reviewAt: result.reviewAt } : {}),
                }
              : {}),
          },
        }
      : {}),
  };
}

export function taskWorkGuidance(work: ReturnType<typeof taskWorkContext>): string {
  return [
    `This attempt's starting assignment includes ${work.assignedAtStart.newEvents} new events and ${work.assignedAtStart.continuingInputs} earlier unanswered inputs.`,
    "Both belong to the owning Task's work; your call still defines your contribution. Empty new events do not make earlier unanswered inputs history-only. Read relevant content and judge what remains against accepted work; reuse verified work without repeating its effects.",
    "Previous result coverage applies only to that result. Converged answers its covered inputs; waiting/incomplete retain them. Missing coverage is unknown, not zero. An empty scope can retain useful partial work; remaining pending inputs can schedule another attempt.",
    "Retained input counts describe the current read and may be truncated or unavailable. They are not a progress score or a total including unclaimed input. An accepted attempt is not completion of every Task obligation.",
  ].join("\n");
}
