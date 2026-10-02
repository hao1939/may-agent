import { createHash } from "node:crypto";
import type {
  MetricDefinition,
  MetricView,
  WorkflowContext,
} from "@may-agent/sdk";

export const name = "retire-metrics";
export const description =
  "Task-bound, fail-closed retirement of one reviewed 39-metric complete-definition manifest. This workflow is an application control, not application authority.";

const COUNT = 39;
const ROW_KEYS = [
  "id",
  "name",
  "type",
  "owner",
  "current",
  "target",
  "threshold",
  "unit",
  "priority",
  "status",
  "blocker",
  "project",
  "source",
  "source_query",
  "source_command",
  "sensitivity",
  "measure_interval",
  "alert_op",
  "speed",
  "description",
  "direction",
  "config",
  "created_at",
  "updated_at",
  "closed_at",
] as const;
const DEFINITION_KEYS = [
  "id",
  "name",
  "owner",
  "type",
  "target",
  "threshold",
  "unit",
  "priority",
  "status",
  "blocker",
  "project",
  "source",
  "sourceQuery",
  "sourceCommand",
  "sensitivity",
  "measureInterval",
  "alertOp",
  "speed",
  "description",
  "direction",
  "config",
] as const;

type JsonObject = Record<string, unknown>;
type CompleteDefinition = {
  id: string;
  name: string;
  owner: string;
  type: "gauge" | "counter" | "health" | "derived";
  target: number | null;
  threshold: number | null;
  unit: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "active" | "retired";
  blocker: string | null;
  project: string | null;
  source: string | null;
  sourceQuery: string | null;
  sourceCommand: string | null;
  sensitivity: number | null;
  measureInterval: number | null;
  alertOp: "<" | ">" | "above" | "below";
  speed: string;
  description: string | null;
  direction: string | null;
  config: Record<string, unknown> | null;
};

type Manifest = {
  version: 1;
  binding: { appId: string; taskId: string; generation: number };
  capture: { capturedAt: string; source: string; sourceRevision: string };
  metricIds: string[];
  before: JsonObject[];
  definitions: CompleteDefinition[];
  expectedAfter: JsonObject[];
  excludedClosed: JsonObject[];
  openAlerts: Array<{ alertId: number; metricId: string; createdAt: number }>;
  baselines: {
    snapshotCountByMetric: Record<string, number>;
    measurementFailureCutoff: number;
  };
};

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as JsonObject;
}
function exactKeys(value: JsonObject, keys: readonly string[], label: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `${label} must contain every exact field (no missing or extra fields)`,
    );
}
function finiteOrNull(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} must be a finite number or null`);
  return value;
}
function stringOrNull(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string")
    throw new Error(`${label} must be a string or null`);
  return value;
}
function canonicalConfig(
  raw: unknown,
  label: string,
): Record<string, unknown> | null {
  if (raw === null) return null;
  if (typeof raw !== "string")
    throw new Error(`${label} raw config must be a string or null`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} raw config is malformed`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(`${label} config must encode an object`);
  if (JSON.stringify(parsed) !== raw)
    throw new Error(
      `${label} config is not byte-representable through MetricService`,
    );
  return parsed as Record<string, unknown>;
}

function parseManifest(text: unknown, digest: unknown): Manifest {
  if (typeof text !== "string" || !text.length)
    throw new Error("manifestJson is required");
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))
    throw new Error("manifestSha256 must be a lowercase SHA-256");
  if (createHash("sha256").update(text).digest("hex") !== digest)
    throw new Error("manifest bytes do not match manifestSha256");
  const root = object(JSON.parse(text), "manifest");
  exactKeys(
    root,
    [
      "version",
      "binding",
      "capture",
      "metricIds",
      "before",
      "definitions",
      "expectedAfter",
      "excludedClosed",
      "openAlerts",
      "baselines",
    ],
    "manifest",
  );
  if (root.version !== 1) throw new Error("manifest version must be 1");
  const binding = object(root.binding, "binding");
  exactKeys(binding, ["appId", "taskId", "generation"], "binding");
  const capture = object(root.capture, "capture");
  exactKeys(capture, ["capturedAt", "source", "sourceRevision"], "capture");
  if (
    ![capture.capturedAt, capture.source, capture.sourceRevision].every(
      (v) => typeof v === "string" && v.length,
    )
  )
    throw new Error("capture provenance must be complete");
  if (!Array.isArray(root.metricIds) || root.metricIds.length !== COUNT)
    throw new Error(`manifest must contain exactly ${COUNT} metric IDs`);
  const ids = root.metricIds as unknown[];
  if (
    ids.some((id) => typeof id !== "string" || !id.length) ||
    new Set(ids).size !== COUNT
  )
    throw new Error("metric IDs must be unique non-empty strings");
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort()))
    throw new Error("metric IDs must be sorted");
  for (const field of ["before", "definitions", "expectedAfter"])
    if (
      !Array.isArray(root[field]) ||
      (root[field] as unknown[]).length !== COUNT
    )
      throw new Error(`${field} must contain exactly ${COUNT} rows`);
  if (!Array.isArray(root.excludedClosed) || root.excludedClosed.length !== 7)
    throw new Error(
      "excludedClosed must contain the seven exact closed witnesses",
    );
  if (!Array.isArray(root.openAlerts))
    throw new Error("openAlerts must be an array");

  const before = (root.before as unknown[]).map((item, index) => {
    const row = object(item, `before[${index}]`);
    exactKeys(row, ROW_KEYS, `before[${index}]`);
    return row;
  });
  const expectedAfter = (root.expectedAfter as unknown[]).map((item, index) => {
    const row = object(item, `expectedAfter[${index}]`);
    exactKeys(row, ROW_KEYS, `expectedAfter[${index}]`);
    return row;
  });
  for (const [index, item] of (root.excludedClosed as unknown[]).entries()) {
    const row = object(item, `excludedClosed[${index}]`);
    exactKeys(row, ROW_KEYS, `excludedClosed[${index}]`);
    if (row.status !== "retired" && row.status !== "closed")
      throw new Error("excluded witnesses must already be closed or retired");
  }

  const definitions = (root.definitions as unknown[]).map((item, index) => {
    const def = object(item, `definitions[${index}]`);
    exactKeys(def, DEFINITION_KEYS, `definitions[${index}]`);
    const beforeRow = before[index]!;
    const id = ids[index] as string;
    if (beforeRow.id !== id || def.id !== id || expectedAfter[index]!.id !== id)
      throw new Error(`row ${index} does not match the reviewed sorted ID set`);
    if (
      beforeRow.status !== "active" ||
      def.status !== "active" ||
      expectedAfter[index]!.status !== "retired"
    )
      throw new Error(`${id} must describe active to retired only`);
    const mapping: Array<[string, string]> = [
      ["name", "name"],
      ["owner", "owner"],
      ["type", "type"],
      ["target", "target"],
      ["threshold", "threshold"],
      ["unit", "unit"],
      ["priority", "priority"],
      ["status", "status"],
      ["blocker", "blocker"],
      ["project", "project"],
      ["source", "source"],
      ["source_query", "sourceQuery"],
      ["source_command", "sourceCommand"],
      ["sensitivity", "sensitivity"],
      ["measure_interval", "measureInterval"],
      ["alert_op", "alertOp"],
      ["speed", "speed"],
      ["description", "description"],
      ["direction", "direction"],
    ];
    for (const [raw, camel] of mapping)
      if (beforeRow[raw] !== def[camel])
        throw new Error(
          `${id} definition does not exactly match before.${raw}`,
        );
    const config = canonicalConfig(beforeRow.config, id);
    if (JSON.stringify(def.config) !== JSON.stringify(config))
      throw new Error(`${id} definition config does not match raw config`);
    if (
      typeof def.name !== "string" ||
      !def.name ||
      typeof def.owner !== "string" ||
      def.owner !== def.owner.trim() ||
      !def.owner
    )
      throw new Error(`${id} has an unrepresentable name or owner`);
    if (
      !["gauge", "counter", "health", "derived"].includes(String(def.type)) ||
      !["P0", "P1", "P2", "P3"].includes(String(def.priority)) ||
      !["<", ">", "above", "below"].includes(String(def.alertOp))
    )
      throw new Error(`${id} has an unsupported definition enum`);
    for (const key of ["target", "threshold", "sensitivity", "measureInterval"])
      finiteOrNull(def[key], `${id}.${key}`);
    for (const key of [
      "blocker",
      "project",
      "source",
      "sourceQuery",
      "sourceCommand",
      "description",
      "direction",
    ])
      stringOrNull(def[key], `${id}.${key}`);
    if (typeof def.unit !== "string" || typeof def.speed !== "string")
      throw new Error(`${id} unit and speed must be strings`);
    const expected = expectedAfter[index]!;
    for (const key of ROW_KEYS) {
      if (key === "status") continue;
      if (key === "updated_at") {
        if (expected[key] !== "$operation-time")
          throw new Error(`${id} expected updated_at must be $operation-time`);
      } else if (expected[key] !== beforeRow[key]) {
        throw new Error(`${id} expectedAfter changes ${key}`);
      }
    }
    return def as unknown as CompleteDefinition;
  });

  const baselines = object(root.baselines, "baselines");
  exactKeys(
    baselines,
    ["snapshotCountByMetric", "measurementFailureCutoff"],
    "baselines",
  );
  const snapshotCounts = object(
    baselines.snapshotCountByMetric,
    "snapshotCountByMetric",
  );
  if (
    JSON.stringify(Object.keys(snapshotCounts).sort()) !== JSON.stringify(ids)
  )
    throw new Error("snapshot baseline must cover the exact ID set");
  if (
    Object.values(snapshotCounts).some(
      (v) => !Number.isSafeInteger(v) || (v as number) < 0,
    ) ||
    !Number.isSafeInteger(baselines.measurementFailureCutoff)
  )
    throw new Error("baselines must be non-negative integer counts/cutoffs");
  for (const [index, value] of (root.openAlerts as unknown[]).entries()) {
    const alert = object(value, `openAlerts[${index}]`);
    exactKeys(
      alert,
      ["alertId", "metricId", "createdAt"],
      `openAlerts[${index}]`,
    );
    if (
      !Number.isSafeInteger(alert.alertId) ||
      (alert.alertId as number) <= 0 ||
      !ids.includes(alert.metricId) ||
      !Number.isSafeInteger(alert.createdAt)
    )
      throw new Error("openAlerts contains an invalid exact alert identity");
  }
  return root as unknown as Manifest;
}

function projectionMismatch(
  view: MetricView | null,
  row: JsonObject,
  status: string,
): string | null {
  if (!view) return "missing";
  const checks: Array<[string, unknown, unknown]> = [
    ["id", view.id, row.id],
    ["status", view.status, status],
    ["current", view.value, row.current],
    ["target", view.target, row.target],
    ["threshold", view.threshold, row.threshold],
    ["unit", view.unit, row.unit],
    ["measure_interval", view.measureInterval ?? null, row.measure_interval],
  ];
  const mismatch = checks.find(([, actual, expected]) => actual !== expected);
  return mismatch
    ? `${mismatch[0]} expected ${JSON.stringify(mismatch[2])}, got ${JSON.stringify(mismatch[1])}`
    : null;
}

export async function execute(ctx: WorkflowContext) {
  try {
    const rec = ctx.reconciliation;
    if (!rec)
      throw new Error("retire-metrics requires an owning Task reconciliation");
    const input = object(ctx.input, "input");
    exactKeys(input, ["manifestJson", "manifestSha256"], "input");
    const manifest = parseManifest(input.manifestJson, input.manifestSha256);
    if (
      manifest.binding.appId !== rec.appId ||
      manifest.binding.taskId !== rec.taskId ||
      manifest.binding.generation !== rec.generation
    )
      throw new Error(
        "manifest binding does not match this exact owning Task generation",
      );

    const beforeReadback = [];
    for (const [index, id] of manifest.metricIds.entries()) {
      const view = await ctx.read.metric(id);
      const mismatch = projectionMismatch(
        view,
        manifest.before[index]!,
        "active",
      );
      beforeReadback.push({ id, view, mismatch });
    }
    const stale = beforeReadback.filter((item) => item.mismatch);
    if (stale.length)
      throw new Error(
        `preflight rejected: ${stale.map((item) => `${item.id}: ${item.mismatch}`).join("; ")}`,
      );

    const retired = manifest.definitions.map((definition) => ({
      ...definition,
      status: "retired" as const,
    }));
    // Runtime MetricService supports these three complete-definition fields even
    // though the public SDK type has not yet exposed them. Keep the cast at this
    // single reviewed boundary; validation above proves all exact fields.
    try {
      ctx.metrics.defineMany(retired as unknown as MetricDefinition[]);
    } catch (error) {
      const readback = await Promise.all(
        manifest.metricIds.map(async (id) => ({
          id,
          view: await ctx.read.metric(id),
        })),
      );
      return ctx.blocked(
        `defineMany failed after a potentially partial sequential update: ${error instanceof Error ? error.message : String(error)}`,
        { manifestSha256: input.manifestSha256, readback },
      );
    }

    const readback = [];
    for (const [index, id] of manifest.metricIds.entries()) {
      const view = await ctx.read.metric(id);
      readback.push({
        id,
        view,
        mismatch: projectionMismatch(view, manifest.before[index]!, "retired"),
      });
    }
    const mismatched = readback.filter((item) => item.mismatch);
    if (mismatched.length)
      return ctx.blocked("retirement readback is incomplete or mismatched", {
        manifestSha256: input.manifestSha256,
        readback,
      });
    return ctx.done(
      `Retired and read back ${COUNT} reviewed metric definitions`,
      {
        manifestSha256: input.manifestSha256,
        count: COUNT,
        readback,
        alerts:
          "not modified; use the canonical HTTP endpoint for manifest openAlerts separately",
      },
    );
  } catch (error) {
    return ctx.blocked(error instanceof Error ? error.message : String(error));
  }
}
