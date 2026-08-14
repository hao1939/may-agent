import type { AppEvent, AppEventTarget } from "@may-agent/sdk";
import { eventData, type AgentEvent } from "./event-bus.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Read-only normalized fact passed to canonical App policy. */
export function canonicalAppEvent(event: AgentEvent): AppEvent<Record<string, unknown>> {
  const envelope = event as unknown as Record<string, unknown>;
  const target = record(envelope.target) as AppEventTarget;
  const urgency = envelope.urgency;
  const action = typeof envelope.action === "string" && envelope.action.trim() ? envelope.action.trim() : undefined;
  return Object.freeze({
    type: event.type,
    data: Object.freeze({ ...eventData(event) }),
    ...(typeof envelope.source === "string" ? { source: envelope.source } : {}),
    ...(typeof envelope.owner === "string" ? { owner: envelope.owner } : {}),
    ...(Object.keys(target).length ? { target: Object.freeze({ ...target }) } : {}),
    ...(action ? { action } : {}),
    ...(urgency === "low" || urgency === "normal" || urgency === "high" || urgency === "immediate" ? { urgency } : {}),
  });
}
