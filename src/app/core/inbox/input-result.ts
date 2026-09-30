import type { AppResult } from "@may-agent/sdk";
import type { AgentEvent } from "../events/bus.js";
import type { AppInboxItem } from "../state/app-inbox-store.js";

/** Explicit App-owned review route, addressed to the App rather than the rejected Task. */
export function appInputAdmissionFailureEvent(
  item: AppInboxItem,
  result: AppResult,
  status: "done" | "blocked",
): AgentEvent | null {
  const fingerprint = result.facts
    ?.find((fact) => fact.startsWith("recovery-fingerprint:"))
    ?.slice("recovery-fingerprint:".length);
  if (!fingerprint) return null;
  return {
    type: "app.input.admission.failed",
    source: "app-inbox",
    owner: `app:${item.appId}`,
    target: { appId: item.appId },
    data: {
      appId: item.appId,
      requestId: item.id,
      targetTaskId: item.targetTaskId,
      conversationId: item.conversationId,
      summary: result.summary,
      response: result.response,
      disposition: status === "done" ? "admission-rejected" : "recovery-pending",
      fingerprint,
      idempotencyKey: `app-input-admission-failure:${item.appId}:${item.id}:${status}:${fingerprint}`,
    },
  };
}

/** The same exact caller feedback for live notification and saved-state recovery. */
export function appInputFeedbackEvent(item: AppInboxItem, result: AppResult & { attemptId?: string; reportRevision?: number }, status: "done" | "blocked" = "done"): AgentEvent | null {
  if (item.source.kind !== "app") return null;
  const recoveryFingerprint = result.facts?.find((fact) => fact.startsWith("recovery-fingerprint:"))
    ?.slice("recovery-fingerprint:".length);
  return {
    type: "app.dependency.updated",
    source: `app-inbox:${item.appId}`,
    owner: `app:${item.source.id}`,
    data: {
      ...(recoveryFingerprint
        ? { idempotencyKey: `app-input-recovery:${item.appId}:${item.id}:${recoveryFingerprint}${status === "done" ? ":rejected" : ""}` }
        : {}),
      kind: "app",
      id: item.id,
      status,
      ...(status === "blocked" && result.attemptId ? { reportAttemptId: result.attemptId } : {}),
      ...(status === "blocked" && result.reportRevision ? { reportRevision: result.reportRevision } : {}),
      summary: result.summary,
      ...(result.response ? { response: result.response } : {}),
      ...(result.result ? { result: result.result } : {}),
      ...(result.facts ? { facts: result.facts } : {}),
      ...(item.waitingOn?.kind === "task" ? { taskId: item.waitingOn.id, appId: item.appId } : {}),
    },
  };
}
