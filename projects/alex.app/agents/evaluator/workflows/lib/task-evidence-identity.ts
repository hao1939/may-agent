/** Normalize only the public Task envelope, never App-authored input/results. */
export function meaningfulTaskDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const { ref, resourceVersion, updatedAt, progress, ...evidence } = detail;
  // Routine eligibility checks are retained in the event log. Older Hosts also
  // include them in bounded Task history; they do not describe changed work.
  if (Array.isArray(evidence.history)) {
    evidence.history = evidence.history.filter((entry) => {
      if (!entry || typeof entry !== "object") return true;
      if (entry.eventType === "project.task.reconcile.skipped") return false;
      // Skipped checks also publish timing, but did not execute an attempt.
      return entry.eventType !== "project.task.reconcile.profiled"
        || (typeof entry.attemptId === "string" && entry.attemptId.trim().length > 0);
    });
  }
  return evidence;
}
