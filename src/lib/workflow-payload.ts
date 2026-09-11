import { redactTranscriptSecrets } from "./persistence.js";
import { types } from "node:util";

// Enough for a small structured evidence packet, not a transcript or file dump.
// Larger outputs should carry artifact references instead of inline contents.
export const MAX_WORKFLOW_PAYLOAD_BYTES = 64 * 1024;
// Deep structures are not small inspection packets even when their leaves are tiny.
const MAX_WORKFLOW_PAYLOAD_DEPTH = 32;
type UnavailableReason = "too-large" | "not-json" | "sensitive-key";

export type WorkflowPayload = { kind: "output" | "evidence" } & (
  { state: "available"; value: unknown; redacted: boolean } | { state: "unavailable"; reason: UnavailableReason }
);

/** Plain JSON inspection copy, without authored hooks; unsupported data never fails completed work. */
export function retainWorkflowPayload(kind: WorkflowPayload["kind"], value: unknown): WorkflowPayload | undefined {
  if (value === undefined) return undefined;
  let redacted = false;
  let reason: UnavailableReason = "not-json";
  let remaining = MAX_WORKFLOW_PAYLOAD_BYTES;
  let sourceRemaining = MAX_WORKFLOW_PAYLOAD_BYTES;
  const chunks: string[] = [];
  const ancestors = new WeakSet<object>();
  const rejectSize = (): never => {
    reason = "too-large";
    throw new Error("Payload limit");
  };
  const append = (text: string) => {
    if (text.length > remaining) rejectSize();
    remaining -= Buffer.byteLength(text);
    if (remaining < 0) rejectSize();
    chunks.push(text);
  };
  const string = (text: string) => {
    const safe = inspectText(text);
    redacted ||= safe !== text;
    append(JSON.stringify(safe));
  };
  const inspectText = (text: string): string => {
    // Redacted output can be tiny; account for cumulative inspected input too.
    if (text.length > sourceRemaining) rejectSize();
    sourceRemaining -= Buffer.byteLength(text);
    if (sourceRemaining < 0) rejectSize();
    return redactTranscriptSecrets(text);
  };
  const visit = (item: unknown, depth: number): void => {
    if (depth > MAX_WORKFLOW_PAYLOAD_DEPTH) rejectSize();
    if (typeof item === "string") return string(item);
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) {
      append(JSON.stringify(item));
      return;
    }
    if (typeof item !== "object" || types.isProxy(item) || ancestors.has(item)) throw new Error("Not plain JSON");
    const array = Array.isArray(item);
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error("Not plain JSON");
    ancestors.add(item);
    const field = (key: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !("value" in descriptor)) throw new Error("Not a data property");
      if (/^(password|secret|token|accessToken|api[_-]?key|authorization)$/i.test(key)) {
        redacted = true;
        append('"[REDACTED]"');
      } else visit(descriptor.value, depth + 1);
    };
    append(array ? "[" : "{");
    let count = 0;
    if (array) {
      if (item.length > remaining) rejectSize();
      for (let i = 0; i < item.length; i++) {
        if (count++) append(",");
        field(String(i));
      }
    } else {
      // Do not materialize an unbounded descriptors/keys array before checking the budget.
      for (const key in item) {
        if (!Object.hasOwn(item, key)) continue;
        if (count++) append(",");
        if (inspectText(key) !== key) {
          // Renaming could collapse distinct keys and misrepresent evidence.
          reason = "sensitive-key";
          throw new Error("Sensitive property name");
        }
        append(JSON.stringify(key));
        append(":");
        field(key);
      }
    }
    append(array ? "]" : "}");
    ancestors.delete(item);
  };
  try {
    visit(value, 0);
    return { kind, state: "available", value: JSON.parse(chunks.join("")), redacted };
  } catch {
    // Do not expose arbitrary serializer errors or stringify the payload again.
    return { kind, state: "unavailable", reason };
  }
}
