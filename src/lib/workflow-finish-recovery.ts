import type { TSchema } from "@earendil-works/pi-ai";
import { classifyError } from "./classify-error.js";
import { isRetryableEmptyAssistantFailure } from "./manager-utils.js";

export function shouldAttemptWorkflowFinishRecovery(
  reason: string | undefined,
): boolean {
  if (!reason) return false;
  return isRetryableEmptyAssistantFailure(reason) || classifyError(reason) === "infra";
}

export function workflowFinishRecoveryPrompt(
  outputSchema?: TSchema,
  reason?: string,
): string {
  const prefix = shouldAttemptWorkflowFinishRecovery(reason)
    ? "Your last turn ended with a transient runtime/provider failure or no visible answer. "
    : "Your last turn ended with no visible answer. ";
  return (
    prefix +
    "Do not repeat prior reads unless they are strictly needed. From the evidence already gathered, call finish() now with all required fields" +
    (outputSchema
      ? ", including the schema-validated result payload. If you are blocked, use finish() with a blocked/partial status and include the required result payload."
      : ".")
  );
}
