/** Normalize only the public Task envelope, never App-authored input/results. */
export function meaningfulTaskDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const { ref, resourceVersion, updatedAt, progress, ...evidence } = detail;
  // Routine eligibility checks are retained in the event log. Older Hosts also
  // include them in bounded Task history; they do not describe changed work.
  if (Array.isArray(evidence.history)) {
    evidence.history = evidence.history.filter((entry) =>
      !entry || typeof entry !== "object" || entry.eventType !== "project.task.reconcile.skipped",
    );
  }
  return evidence;
}
