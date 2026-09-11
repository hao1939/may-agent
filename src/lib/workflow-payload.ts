import { redactTranscriptSecrets } from "./persistence.js";

// Enough for a small structured evidence packet, not a transcript or file dump.
// Larger outputs should carry artifact references instead of inline contents.
export const MAX_WORKFLOW_PAYLOAD_BYTES = 64 * 1024;

export type WorkflowPayload = { kind: "output" | "evidence" } & (
  { state: "available"; value: unknown; redacted: boolean } | { state: "unavailable"; reason: "too-large" | "not-json" }
);

/** Optional inspection copy; a bad payload must not fail completed work. */
export function retainWorkflowPayload(kind: WorkflowPayload["kind"], value: unknown): WorkflowPayload | undefined {
  if (value === undefined) return undefined;
  let redacted = false;
  try {
    const json = JSON.stringify(
      value,
      (key, item: unknown) => {
        if (
          typeof item === "function" ||
          typeof item === "symbol" ||
          (typeof item === "number" && !Number.isFinite(item))
        )
          throw new Error("Not JSON data");
        const safe = /^(password|secret|token|accessToken|api[_-]?key|authorization)$/i.test(key)
          ? "[REDACTED]"
          : typeof item === "string"
            ? redactTranscriptSecrets(item)
            : item;
        redacted ||= safe !== item;
        return safe;
      },
      2,
    );
    if (json === undefined) return { kind, state: "unavailable", reason: "not-json" };
    if (Buffer.byteLength(json) > MAX_WORKFLOW_PAYLOAD_BYTES)
      return { kind, state: "unavailable", reason: "too-large" };
    return { kind, state: "available", value: JSON.parse(json), redacted };
  } catch {
    // Do not expose arbitrary serializer errors or stringify the payload again.
    return { kind, state: "unavailable", reason: "not-json" };
  }
}
