import type { TaskAttempt, TaskDetail, TaskReconciliationEvents } from "@may-agent/sdk/app";

/** Shared interpretation for every executor; observations grant no authority. */
export function taskWorkloadGuidance(workload: TaskAttempt["workload"]): string {
  if (!workload) return "";
  return [
    "Workload at attempt start is a scoped observation, not an admission decision.",
    "Respect its time, coverage and unavailable fields; missing or truncated facts do not prove spare capacity.",
    "Required work remains owed under pressure. Use the observations to judge priorities, methods and discretionary expansion.",
    "Idle and blocked assignments are not execution utilization.",
    "App limits and the Host controller observation have separate scopes; neither reserves an execution slot.",
    "Fields marked unavailable establish neither an allowance nor a denial.",
    "Pressure does not prove fulfillment or authorize closure; the creator retains that decision.",
  ].join(" ");
}

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
    pendingUnclaimed: task.pendingEvents
      ? {
          available: true as const,
          newEvents: task.pendingEvents.items.length,
          moreEvents: task.pendingEvents.truncated,
        }
      : { available: false as const },
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
  const unclaimedSummary = work.pendingUnclaimed.available
    ? `Unclaimed pendingEvents currently has ${work.pendingUnclaimed.newEvents} arrived event(s).`
    : "Unclaimed pendingEvents is unavailable in this snapshot.";
  return [
    `This attempt's starting assignment includes ${work.assignedAtStart.newEvents} new events and ${work.assignedAtStart.continuingInputs} earlier unanswered inputs. ${unclaimedSummary}`,
    "Assigned input (attemptInput / reconciliation.events) was claimed for this attempt and removed from pendingEvents; an empty pendingEvents / pendingInput window NEVER means this attempt has no assigned review, correction or continuing input.",
    "Both new events and earlier unanswered inputs belong to the owning Task's work; your call still defines your contribution. Read relevant content (following detail/context.json pointers when omitted) and judge what remains against accepted work; reuse verified work without repeating its effects.",
    "Previous result coverage applies only to that result. Converged answers its covered inputs; waiting/incomplete retain them. Missing coverage is unknown, not zero. An empty scope can retain useful partial work; remaining pending inputs can schedule another attempt.",
    "Retained input counts describe the current read and may be truncated or unavailable. They are not a progress score or a total including unclaimed input. An accepted attempt is not completion of every Task obligation.",
  ].join("\n");
}
