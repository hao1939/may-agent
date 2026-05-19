export interface CanonicalEventEnvelopeOptions {
  source?: unknown;
  owner?: unknown;
  urgency?: unknown;
  ttl_ms?: unknown;
  timestamp?: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeEventOwner(owner: unknown, fallback: unknown = "may"): string {
  const value = nonEmptyString(owner) ?? nonEmptyString(fallback) ?? "may";
  if (value.startsWith("agent:") || value.startsWith("human:")) return value;
  if (value.toLowerCase() === "human") return "human:operator";
  return `agent:${value}`;
}

export function isCanonicalEventEnvelope(event: Record<string, unknown>): boolean {
  return !!nonEmptyString(event.source)
    && !!nonEmptyString(event.owner)
    && isRecord(event.data);
}

function hasOnlyEnvelopeFields(event: Record<string, unknown>): boolean {
  return Object.keys(event).every((key) => (
    key === "type"
    || key === "source"
    || key === "owner"
    || key === "urgency"
    || key === "ttl_ms"
    || key === "timestamp"
    || key === "data"
  ));
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
    urgency,
    ttl_ms,
    timestamp,
    data,
    ...payload
  } = input;

  const eventData = isRecord(data) ? { ...data, ...payload } : payload;
  const envelopeUrgency = nonEmptyString(urgency) ?? nonEmptyString(defaults.urgency);
  const envelopeTtl = typeof ttl_ms === "number" ? ttl_ms : defaults.ttl_ms;
  const envelopeTimestamp = typeof timestamp === "number" ? timestamp : defaults.timestamp;

  return {
    type,
    source: nonEmptyString(source) ?? nonEmptyString(defaults.source) ?? "control",
    owner: normalizeEventOwner(owner, defaults.owner),
    ...(envelopeUrgency ? { urgency: envelopeUrgency } : {}),
    ...(typeof envelopeTtl === "number" ? { ttl_ms: envelopeTtl } : {}),
    ...(typeof envelopeTimestamp === "number" ? { timestamp: envelopeTimestamp } : {}),
    data: eventData,
  };
}
