export interface CanonicalEventEnvelopeOptions {
  source?: unknown;
  owner?: unknown;
  target?: unknown;
  action?: unknown;
  urgency?: unknown;
  ttl_ms?: unknown;
  timestamp?: unknown;
  visibility?: unknown;
  trace?: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeEventOwner(owner: unknown, fallback: unknown = "may"): string {
  const value = nonEmptyString(owner) ?? nonEmptyString(fallback) ?? "may";
  if (
    value.startsWith("agent:") ||
    value.startsWith("app:") ||
    value.startsWith("human:") ||
    value.startsWith("project:") ||
    value.startsWith("task:")
  )
    return value;
  if (value.toLowerCase() === "human") return "human:operator";
  return `agent:${value}`;
}

function ownerFromTarget(target: unknown): string | undefined {
  if (!isRecord(target)) return undefined;
  if (target.human === true) return "human:operator";
  if (typeof target.project === "string" && target.project.trim()) {
    return `project:${target.project.trim()}`;
  }
  return undefined;
}

function inferEventOwner(input: { owner?: unknown; target?: unknown; fallback?: unknown }): string {
  if (nonEmptyString(input.owner)) return normalizeEventOwner(input.owner);
  const targetOwner = ownerFromTarget(input.target);
  if (targetOwner) return targetOwner;
  return normalizeEventOwner(input.fallback);
}

export function isCanonicalEventEnvelope(event: Record<string, unknown>): boolean {
  return !!nonEmptyString(event.source) && !!nonEmptyString(event.owner) && isRecord(event.data);
}

function hasOnlyEnvelopeFields(event: Record<string, unknown>): boolean {
  return Object.keys(event).every(
    (key) =>
      key === "type" ||
      key === "source" ||
      key === "owner" ||
      key === "target" ||
      key === "action" ||
      key === "urgency" ||
      key === "ttl_ms" ||
      key === "timestamp" ||
      key === "visibility" ||
      key === "trace" ||
      key === "data",
  );
}

export function buildCanonicalEventEnvelope(
  type: string,
  input: Record<string, unknown> = {},
  defaults: CanonicalEventEnvelopeOptions = {},
): Record<string, unknown> {
  if (isCanonicalEventEnvelope(input) && hasOnlyEnvelopeFields(input)) {
    return {
      ...input,
      type,
      source: nonEmptyString(input.source),
      owner: normalizeEventOwner(input.owner),
    };
  }

  const {
    type: _inputType,
    source,
    owner,
    target,
    action,
    urgency,
    ttl_ms,
    timestamp,
    visibility,
    trace,
    data,
    ...payload
  } = input;

  const eventData = isRecord(data) ? { ...data, ...payload } : payload;
  const envelopeTarget = isRecord(target) ? target : isRecord(defaults.target) ? defaults.target : undefined;
  const envelopeAction = nonEmptyString(action) ?? nonEmptyString(defaults.action);
  const envelopeUrgency = nonEmptyString(urgency) ?? nonEmptyString(defaults.urgency);
  const envelopeTtl = typeof ttl_ms === "number" ? ttl_ms : defaults.ttl_ms;
  const envelopeTimestamp = typeof timestamp === "number" ? timestamp : defaults.timestamp;
  const envelopeVisibility = nonEmptyString(visibility) ?? nonEmptyString(defaults.visibility);
  const envelopeTrace = isRecord(trace) ? trace : isRecord(defaults.trace) ? defaults.trace : undefined;

  return {
    type,
    source: nonEmptyString(source) ?? nonEmptyString(defaults.source) ?? "control",
    owner: inferEventOwner({ owner, target: envelopeTarget, fallback: defaults.owner }),
    ...(envelopeTarget ? { target: envelopeTarget } : {}),
    ...(envelopeAction ? { action: envelopeAction } : {}),
    ...(envelopeUrgency ? { urgency: envelopeUrgency } : {}),
    ...(typeof envelopeTtl === "number" ? { ttl_ms: envelopeTtl } : {}),
    ...(typeof envelopeTimestamp === "number" ? { timestamp: envelopeTimestamp } : {}),
    ...(envelopeVisibility ? { visibility: envelopeVisibility } : {}),
    ...(envelopeTrace ? { trace: envelopeTrace } : {}),
    data: eventData,
  };
}
