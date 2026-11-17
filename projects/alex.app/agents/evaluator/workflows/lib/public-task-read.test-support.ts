/** Project retained test assignments onto the proposed public detail contract.
 * Saved input/creator/obligations require the matching Host change; these
 * fixtures alone do not establish support in the installed Host.
 */
export function publicTaskFixture(
  assignment: Record<string, unknown>,
  detail: Record<string, unknown>,
): Record<string, unknown> {
  const diagnostics = (detail.diagnostics ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = { ...detail };
  for (const key of [
    "generation", "outcome", "acceptance", "status", "summary", "response",
    "result", "facts", "input", "creator", "currentObligations",
    "activeAttempt", "pendingEvents", "acceptedAttempt", "acceptedEvidence", "requestedBy",
  ]) {
    if (Object.hasOwn(assignment, key) && !Object.hasOwn(detail, key)) result[key] = assignment[key];
  }
  result.diagnostics = {
    ...diagnostics,
    ...(assignment.agent ? { owner: assignment.agent } : {}),
    ...(Array.isArray(assignment.dependsOn)
      ? { dependencies: assignment.dependsOn.map((id) => ({ id, status: "idle" })) }
      : {}),
    ...(Array.isArray(assignment.conditions)
      ? { conditions: assignment.conditions.map((condition) => {
          const { observation, id, ...spec } = condition;
          return { id, condition: {
            metadata: { id, generation: 1, resourceVersion: 1 },
            spec, status: observation ?? { state: "unknown" },
          } };
        }) }
      : {}),
  };
  return result;
}
