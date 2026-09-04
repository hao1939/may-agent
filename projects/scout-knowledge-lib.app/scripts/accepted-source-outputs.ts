import { readFileSync } from "node:fs";

export const ACCEPTED_SOURCE_OUTPUTS_METRIC_ID =
  "scout.latest-accepted-source-outputs-per-source";
export const RETIRED_ACCEPTED_SOURCE_OUTPUTS_24H_METRIC_ID =
  "scout.accepted-source-outputs-24h";
export const DEFAULT_SCOUT_TASK_STATE_PATH =
  "/app/projects/scout-knowledge-lib.app/.state/tasks/state.json";
export const SCOUT_EXPLORATION_SOURCES = [
  "arxiv",
  "hn",
  "xhs",
  "github",
  "reddit",
] as const;

export type ScoutExplorationSource = (typeof SCOUT_EXPLORATION_SOURCES)[number];
export type ScoutSourceOutputState =
  | "accepted-output"
  | "converged-without-output"
  | "not-converged"
  | "resource-unavailable";

export type AcceptedSourceOutputReceipt = {
  id: string;
  taskId: string;
  source: string;
  completedAt: string;
  outputs: string[];
};

export type AcceptedSourceOutputSample = {
  value: number;
  sampleSize: number;
  measuredAt: number;
  note: {
    semantics: "latest-converged-resource-per-source";
    source: "scout-task-resources";
    statePath: string;
    resourceCount: number;
    completedAttemptCount: number;
    outputs: string[];
    sourceOutputCounts: Record<ScoutExplorationSource, number>;
    sourceStates: Record<ScoutExplorationSource, ScoutSourceOutputState>;
    resources: AcceptedSourceOutputReceipt[];
  };
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function durableOutputs(value: unknown): string[] {
  const row = record(value);
  return stringArray(row.evidence)
    .concat(stringArray(record(row.acceptanceBasis).evidence))
    .filter((item) => item.startsWith("output:") && item.length > 7)
    .map((item) => item.slice(7));
}

function sourceForTask(
  taskId: string,
  resource: JsonRecord,
): ScoutExplorationSource | null {
  const spec = record(resource.spec);
  if (spec.workflow !== "scout-explore") return null;
  const inputSource = record(spec.input).source;
  const source =
    typeof inputSource === "string"
      ? inputSource
      : taskId.startsWith("explore-")
        ? taskId.slice("explore-".length)
        : "";
  return SCOUT_EXPLORATION_SOURCES.includes(source as ScoutExplorationSource)
    ? (source as ScoutExplorationSource)
    : null;
}

/**
 * Collect durable outputs represented by each source's latest canonical task
 * resource. Canonical attempts retain run timing and prose only, not durable
 * output evidence, so this collector deliberately does not claim rolling-window
 * or successive-run coverage.
 */
export function collectAcceptedSourceOutputs(
  state: unknown,
  options: { now?: number; statePath?: string } = {},
): AcceptedSourceOutputSample {
  const now = options.now ?? Date.now();
  const statePath = options.statePath ?? DEFAULT_SCOUT_TASK_STATE_PATH;
  const root = record(state);
  const resources = record(root.resources);
  const acceptedResources: AcceptedSourceOutputReceipt[] = [];

  for (const [taskId, rawResource] of Object.entries(resources)) {
    const resource = record(rawResource);
    const source = sourceForTask(taskId, resource);
    const status = record(resource.status);
    if (
      !source ||
      status.phase !== "converged" ||
      typeof status.updatedAt !== "string"
    ) {
      continue;
    }
    const outputs = [...new Set(durableOutputs(status))];
    if (outputs.length === 0) continue;
    acceptedResources.push({
      id: `resource:${taskId}@${status.updatedAt}`,
      taskId,
      source,
      completedAt: status.updatedAt,
      outputs,
    });
  }

  acceptedResources.sort((a, b) => a.id.localeCompare(b.id));
  const outputs = [
    ...new Set(acceptedResources.flatMap((resource) => resource.outputs)),
  ].sort();
  const sourceOutputCounts = Object.fromEntries(
    SCOUT_EXPLORATION_SOURCES.map((source) => [
      source,
      new Set(
        acceptedResources
          .filter((resource) => resource.source === source)
          .flatMap((resource) => resource.outputs),
      ).size,
    ]),
  ) as Record<ScoutExplorationSource, number>;
  const sourceStates = Object.fromEntries(
    SCOUT_EXPLORATION_SOURCES.map((source) => {
      const sourceResources = Object.entries(resources)
        .filter(
          ([taskId, rawResource]) =>
            sourceForTask(taskId, record(rawResource)) === source,
        )
        .map(([, rawResource]) => record(rawResource));
      const state: ScoutSourceOutputState =
        sourceOutputCounts[source] > 0
          ? "accepted-output"
          : sourceResources.length === 0
            ? "resource-unavailable"
            : sourceResources.some(
                  (resource) => record(resource.status).phase === "converged",
                )
              ? "converged-without-output"
              : "not-converged";
      return [source, state];
    }),
  ) as Record<ScoutExplorationSource, ScoutSourceOutputState>;
  const completedAttemptCount = Object.values(record(root.attempts)).filter(
    (rawAttempt) => {
      const attempt = record(rawAttempt);
      const taskId = typeof attempt.taskId === "string" ? attempt.taskId : "";
      return (
        sourceForTask(taskId, record(resources[taskId])) !== null &&
        attempt.owner === "scout" &&
        attempt.handler === "workflow:scout-explore" &&
        attempt.state === "completed"
      );
    },
  ).length;

  return {
    value: outputs.length,
    sampleSize: acceptedResources.length,
    measuredAt: now,
    note: {
      semantics: "latest-converged-resource-per-source",
      source: "scout-task-resources",
      statePath,
      resourceCount: acceptedResources.length,
      completedAttemptCount,
      outputs,
      sourceOutputCounts,
      sourceStates,
      resources: acceptedResources,
    },
  };
}

export function sampleAcceptedSourceOutputs(
  statePath = DEFAULT_SCOUT_TASK_STATE_PATH,
  now = Date.now(),
): AcceptedSourceOutputSample {
  return collectAcceptedSourceOutputs(
    JSON.parse(readFileSync(statePath, "utf8")) as unknown,
    { now, statePath },
  );
}

if (import.meta.main) {
  const sample = sampleAcceptedSourceOutputs();
  process.stdout.write(JSON.stringify(sample));
}
