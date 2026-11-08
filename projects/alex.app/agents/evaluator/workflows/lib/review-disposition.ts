import type { WorkflowContext } from "@may-agent/sdk";
import type { Reviewer } from "./reviewer-profile.js";
import { readPublishedTaskReport } from "./task-report-store.js";

const MAX_DISPOSITIONS = 4;

/** Consume only this creator's completed finite assessments. Names discover;
 * exact current reads and the validated publication establish authority. */
export async function consumePublishedReviews(
  ctx: WorkflowContext<unknown>,
  taskIds: string[],
  reviewer: Reviewer,
  reportRoot: string,
  offset: number,
): Promise<{ closed: string[]; facts: string[]; nextOffset: number }> {
  const result = { closed: [] as string[], facts: [] as string[], nextOffset: offset };
  const creator = ctx.reconciliation;
  if (!ctx.closeTask || !creator?.appId || !creator.taskId || !taskIds.length)
    return result;
  const count = Math.min(MAX_DISPOSITIONS, taskIds.length);
  result.nextOffset = (offset + count) % taskIds.length;
  for (let index = 0; index < count; index++) {
    const taskId = taskIds[(offset + index) % taskIds.length]!;
    try {
      const task = await ctx.read.tasks.get(taskId);
      if (!task) continue;
      const accepted = task.acceptedAttempt;
      const obligations = task.currentObligations;
      if (
        task.id !== taskId || task.workflow !== "task-outcome-review" ||
        (task.agent ?? task.owner) !== reviewer ||
        task.creator?.appId !== creator.appId || task.creator.taskId !== creator.taskId ||
        task.status !== "idle" || !task.response?.trim() ||
        !accepted?.id || accepted.generation !== task.generation ||
        !Number.isSafeInteger(task.resourceVersion) ||
        obligations?.available !== true || obligations.reviewAt !== undefined ||
        obligations.inputWaits.truncated || obligations.inputWaits.items.length ||
        !task.pendingEvents || task.pendingEvents.truncated || task.pendingEvents.items.length ||
        !Array.isArray(task.conditions) || task.conditions.length
      ) continue;

      // Facts come from the guarded accepted result. Conflicting or absent
      // identity fields do not authorize disposal of the responsibility.
      const fact = (prefix: string): string => {
        const values = (task.facts ?? []).filter(value => value.startsWith(prefix));
        return values.length === 1 ? values[0]!.slice(prefix.length) : "";
      };
      const input = task.input;
      const appId = typeof input.appId === "string" ? input.appId : "";
      const subjectId = typeof input.taskId === "string" ? input.taskId : "";
      const evidenceHash = fact("evidence-hash:");
      const generation = Number(fact("subject-generation:"));
      const publication = readPublishedTaskReport(reportRoot, fact("report-facts:"));
      if (
        !appId || !subjectId || fact("subject:") !== `${appId}/${subjectId}` ||
        fact("reviewer:") !== reviewer ||
        !Number.isSafeInteger(generation) || generation < 1 ||
        !/^[a-f0-9]{64}$/.test(evidenceHash) ||
        (input.evidenceHash !== undefined && input.evidenceHash !== evidenceHash) ||
        (input.subjectGeneration !== undefined && input.subjectGeneration !== generation) ||
        !publication || publication.appId !== appId || publication.taskId !== subjectId ||
        publication.reviewer !== reviewer || publication.evidenceHash !== evidenceHash ||
        publication.purpose !== (input.assessmentPurpose ?? "outcome") ||
        publication.disposition !== fact("review-disposition:") ||
        publication.executionId !== fact("execution:") ||
        publication.markdownPath !== fact("report:") ||
        (publication.snapshot && publication.snapshot.generation !== generation)
      ) continue;

      const closed = await ctx.closeTask({
        appId: creator.appId,
        taskId,
        expectedGeneration: task.generation,
        expectedResourceVersion: task.resourceVersion!,
        afterResult: accepted.id,
        reason: "Consumed the published finite assessment; its immutable report remains available to the accountable owner.",
      });
      if (closed.id !== taskId || closed.status !== "closed")
        throw new Error("Closure was not confirmed");
      result.closed.push(taskId);
      result.facts.push(`selector:review-closed:${taskId}`);
    } catch {
      // A stale read, missing capability or racing correction retains the
      // assignment. The next ordinary pass can reconsider current evidence.
      result.facts.push(`selector:review-disposition-deferred:${taskId}`);
    }
  }
  return result;
}
