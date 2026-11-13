import type { AppTaskResultContext } from "@may-agent/sdk";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Reserved App routes: a finished repair cycle leaves the next notice deliverable. */
export function isAlexOperationalRecoveryTask(
  appId: string,
  taskId: string,
): boolean {
  return (
    appId === "alex" &&
    (taskId === "runtime/selector-recovery" || taskId.startsWith("runtime/recovery/"))
  );
}

/** App authority over its finite root assignments; delegated work keeps its creator. */
export function closeAcceptedAssignment({
  task,
  acceptedResult,
}: AppTaskResultContext): { reason: string } | null {
  if (isAlexOperationalRecoveryTask("alex", task.id)) return null;
  const input = object(task.input);
  if (input.kind !== "message" && input.kind !== "goal") return null;
  const context = object(object(input.data).context);
  if (
    object(context.audit).mode === "standing" ||
    object(context.research).mode === "standing"
  )
    return null;
  const disposition = object(acceptedResult.result?.taskDisposition);
  if (
    disposition.kind !== "close" ||
    typeof disposition.reason !== "string" ||
    !disposition.reason.trim() ||
    !acceptedResult.facts.length
  )
    return null;
  return { reason: disposition.reason.trim() };
}
