import { Type, type Static } from "@may-agent/sdk";
import { Check } from "typebox/value";
import { createHash } from "node:crypto";
import type { MetricEvidence } from "../alex.app/agents/evaluator/workflows/lib/metric-evidence.js";

const scalar = Type.Union([
  Type.String({ maxLength: 512 }),
  Type.Number(),
  Type.Boolean(),
  Type.Null(),
]);
const field = Type.String({
  maxLength: 160,
  pattern:
    "^(latest|source|calculation|current|previous|comparison|freshness)(\\.[A-Za-z0-9_-]+)*$",
});
// The existing Condition vocabulary, restricted to one scalar comparison per
// predicate. No coercion, expressions, external URLs or executable predicates.
export const metricScopePredicateSchema = Type.Union([
  ...["equals", "notEquals"].map((op) =>
    Type.Object({ field, [op]: scalar }, { additionalProperties: false }),
  ),
  Type.Object(
    { field, anyOf: Type.Array(scalar, { minItems: 1, maxItems: 8 }) },
    { additionalProperties: false },
  ),
  ...["gt", "gte", "lt", "lte"].map((op) =>
    Type.Object(
      { field, [op]: Type.Number() },
      { additionalProperties: false },
    ),
  ),
]);
export const metricReuseScopeSchema = Type.Object(
  {
    concern: Type.String({ minLength: 1, maxLength: 400 }),
    applicability: Type.Array(metricScopePredicateSchema, {
      minItems: 1,
      maxItems: 12,
    }),
    reconsiderWhen: Type.Array(metricScopePredicateSchema, { maxItems: 8 }),
  },
  { additionalProperties: false },
);
export type MetricReuseScope = Static<typeof metricReuseScopeSchema>;
const basisSchema = Type.Object(
  {
    end: Type.Integer({ minimum: 1 }),
    evidenceHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    definitionHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    measuredBy: Type.String({ minLength: 1, maxLength: 512 }),
  },
  { additionalProperties: false },
);
const boundSchema = Type.Object(
  {
    ...metricReuseScopeSchema.properties,
    basis: basisSchema,
  },
  { additionalProperties: false },
);
export type BoundMetricReuseScope = Static<typeof boundSchema>;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};

/** Bind all exposed definition/responsibility fields, not just metric identity. */
export function metricDefinitionHash(evidence: MetricEvidence): string {
  return hash(
    stable({
      metric: evidence.metric,
      responsibility: evidence.responsibility,
      alertRule: evidence.alertRule,
      calculationRule: evidence.calculationRule,
    }),
  );
}

function truncated(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      (/truncated$/i.test(key) && child !== false && child !== 0) ||
      truncated(child),
  );
}

function fieldValue(evidence: MetricEvidence, path: string): unknown {
  const parts = path.split(".");
  if (
    parts.some((part) =>
      ["__proto__", "prototype", "constructor"].includes(part),
    )
  )
    return undefined;
  let root: Record<string, unknown> = evidence;
  if (parts[0] === "source") {
    const latest = object(evidence.latest);
    if (latest.noteTruncated !== false && latest.noteTruncated !== 0)
      return undefined;
    try {
      const source = JSON.parse(latest.note);
      if (truncated(source)) return undefined;
      root = { source };
    } catch {
      return undefined;
    }
  }
  // Notes must be decoded through source, where coverage is checked.
  if (parts[0] !== "source" && parts.includes("note")) return undefined;
  let value: unknown = root;
  for (const part of parts) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, part))
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/** null means unavailable/incomparable, including a missing notEquals field. */
export function matchMetricPredicate(
  evidence: MetricEvidence,
  predicate: Record<string, any>,
): boolean | null {
  const actual = fieldValue(evidence, predicate.field);
  if (
    actual === undefined ||
    (actual !== null &&
      !["string", "number", "boolean"].includes(typeof actual))
  )
    return null;
  if (typeof actual === "number" && !Number.isFinite(actual)) return null;
  if ("equals" in predicate) return actual === predicate.equals;
  if ("notEquals" in predicate) return actual !== predicate.notEquals;
  if ("anyOf" in predicate)
    return predicate.anyOf.some((value: unknown) => value === actual);
  if (typeof actual !== "number") return null;
  if ("gt" in predicate) return actual > predicate.gt;
  if ("gte" in predicate) return actual >= predicate.gte;
  if ("lt" in predicate) return actual < predicate.lt;
  if ("lte" in predicate) return actual <= predicate.lte;
  return null;
}

function withinScope(
  scope: MetricReuseScope,
  evidence: MetricEvidence,
): boolean {
  return (
    evidence.available === true &&
    evidence.metric?.id === evidence.metricId &&
    evidence.responsibility?.status === "resolved" &&
    !!evidence.responsibility.appId &&
    evidence.freshness === "fresh" &&
    scope.applicability.every(
      (p) => matchMetricPredicate(evidence, p) === true,
    ) &&
    scope.reconsiderWhen.every(
      (p) => matchMetricPredicate(evidence, p) === false,
    )
  );
}

/** Preparation checks current observations; only Host acceptance creates a decision. */
export function bindMetricReuseScope(
  scope: MetricReuseScope,
  evidence: MetricEvidence,
): BoundMetricReuseScope {
  const measuredBy = object(evidence.latest).measuredBy;
  if (
    !Check(metricReuseScopeSchema, scope) ||
    !scope.concern.trim() ||
    !withinScope(scope, evidence) ||
    typeof measuredBy !== "string" ||
    !measuredBy.trim() ||
    !Number.isSafeInteger(evidence.end) ||
    evidence.end <= 0
  )
    throw new Error(
      "Metric reuse scope requires matching, complete current observations and a source identity",
    );
  const bound = {
    ...scope,
    basis: {
      end: evidence.end,
      evidenceHash: hash(JSON.stringify(evidence)),
      definitionHash: metricDefinitionHash(evidence),
      measuredBy,
    },
  };
  if (!Check(boundSchema, bound))
    throw new Error("Metric reuse scope exceeds its evidence bounds");
  return bound;
}

export function readBoundMetricReuseScope(
  value: unknown,
): BoundMetricReuseScope | null {
  return Check(boundSchema, value) ? value : null;
}

export function metricScopeCovers(
  scope: BoundMetricReuseScope,
  evidence: MetricEvidence,
): boolean {
  return (
    withinScope(scope, evidence) &&
    metricDefinitionHash(evidence) === scope.basis.definitionHash &&
    object(evidence.latest).measuredBy === scope.basis.measuredBy
  );
}
