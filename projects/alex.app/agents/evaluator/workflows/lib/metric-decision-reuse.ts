import { createHash } from "node:crypto";
import {
  metricScopeCovers,
  readBoundMetricReuseScope,
} from "../../../../../may.app/metric-decision-reuse.js";
import { createPublicTaskEvidenceProvider } from "./public-task-evidence.js";
import type { MetricEvidence, MetricReader } from "./metric-evidence.js";

export type MetricOwnerTaskReader = (
  appId: string,
  taskId: string,
) => Promise<Record<string, any>>;
export const readMetricOwnerTask: MetricOwnerTaskReader = async (
  appId,
  taskId,
) => {
  // app.task.get exposes complete current obligations and Condition observations;
  // the human-facing task.get projection can omit those fields.
  const task = await createPublicTaskEvidenceProvider().getAppTask(
    appId,
    taskId,
  );
  return { ...task, appId };
};

const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const identity = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim();
const dueOrInvalid = (value: unknown, now: number) =>
  value !== undefined &&
  (typeof value !== "number" || !Number.isSafeInteger(value) || value <= now);

function taskIsQuiet(task: Record<string, any>, now: number): boolean {
  const obligations = record(task.currentObligations);
  const waits = record(obligations.inputWaits);
  const events = record(task.pendingEvents);
  if (
    !["waiting", "done"].includes(task.status) ||
    obligations.available !== true ||
    dueOrInvalid(obligations.reviewAt, now) ||
    waits.truncated !== false ||
    !Array.isArray(waits.items) ||
    events.truncated !== false ||
    !Array.isArray(events.items) ||
    events.items.length ||
    !Array.isArray(task.conditions)
  )
    return false;
  if (
    waits.items.some(
      (wait: any) =>
        !wait || wait.pending === true || dueOrInvalid(wait.reviewAt, now),
    )
  )
    return false;
  // Missing/unknown or newly satisfied Conditions leave judgment with the owner.
  return task.conditions.every((condition: any) => {
    const observation = record(condition?.observation);
    return (
      observation.state === "false" &&
      Number.isSafeInteger(observation.generation) &&
      observation.observedGeneration === observation.generation &&
      !dueOrInvalid(observation.reviewAt, now)
    );
  });
}

export type MetricDecisionReuse =
  | { reusable: false; reason: string }
  | {
      reusable: true;
      decision: {
        appId: string;
        taskId: string;
        attemptId: string;
        timestamp: number;
        alertId: number | null;
        scope: unknown;
        evidence: string[];
      };
      currentEnd: number;
      currentEvidenceHash: string;
      tasks: Array<{
        appId: string;
        taskId: string;
        generation: number;
        resourceVersion: number;
      }>;
    };

/** Optional eligibility, never a new recovery path. Any uncertain read falls back. */
export async function checkMetricDecisionReuse(
  observation: MetricEvidence,
  reader: MetricReader,
  readTask: MetricOwnerTaskReader = readMetricOwnerTask,
  now = Date.now(),
): Promise<MetricDecisionReuse> {
  const no = (reason: string): MetricDecisionReuse => ({
    reusable: false,
    reason,
  });
  try {
    // Unfiltered history is needed: a newer no-scope decision on another alert
    // supersedes the old scope, even if absent from relatedDispositions' limit.
    const current = await reader(observation.metricId, now);
    if (
      current.metricId !== observation.metricId ||
      current.end !== now ||
      current.available !== true ||
      current.responsibility?.status !== "resolved" ||
      !Array.isArray(current.dispositions)
    )
      return no("current-evidence-unavailable");
    const accountable = new Set(["may", current.responsibility.appId]);
    const rows = current.dispositions.filter((row) =>
      accountable.has(row?.appId),
    );
    if (!rows.length) return no("no-accepted-owner-decision");
    // Refuse malformed ordering evidence, rather than accidentally skipping a
    // newer revocation. Duplicate decisions at the newest timestamp are ambiguous.
    if (
      rows.some(
        (row) =>
          !Number.isSafeInteger(row.timestamp) ||
          row.timestamp <= 0 ||
          row.timestamp >= now,
      )
    )
      return no("decision-order-unavailable");
    rows.sort((a, b) => b.timestamp - a.timestamp);
    const row = rows[0];
    if (rows[1]?.timestamp === row.timestamp)
      return no("ambiguous-latest-decision");
    // Older omitted history is harmless only when it cannot tie this decision.
    if (
      current.dispositionsTruncated === true &&
      row.timestamp <= current.dispositions.at(-1)?.timestamp
    )
      return no("latest-decision-at-history-boundary");
    const decision = record(row.decision);
    const scope = readBoundMetricReuseScope(decision.reuseScope);
    if (
      !identity(row.appId) ||
      !identity(row.taskId) ||
      !identity(row.attemptId) ||
      decision.version !== 1 ||
      decision.metricId !== observation.metricId ||
      !identity(decision.reason) ||
      !["observe", "investigate", "no-change", "recovered"].includes(
        decision.disposition,
      ) ||
      !(
        decision.alertId === null ||
        (Number.isSafeInteger(decision.alertId) && decision.alertId > 0)
      ) ||
      !Array.isArray(decision.evidence) ||
      !decision.evidence.length ||
      decision.evidence.length > 16 ||
      !decision.evidence.every(identity) ||
      !scope ||
      scope.basis.end > row.timestamp
    )
      return no("latest-decision-has-no-valid-scope");
    if (
      !metricScopeCovers(scope, observation) ||
      !metricScopeCovers(scope, current)
    )
      return no("scope-changed-or-unavailable");

    const links = [{ appId: row.appId, taskId: row.taskId }];
    if (decision.linkedTask !== undefined) {
      const link = record(decision.linkedTask);
      if (!identity(link.appId) || !identity(link.taskId))
        return no("invalid-owner-task-link");
      if (link.appId !== row.appId || link.taskId !== row.taskId)
        links.push({ appId: link.appId, taskId: link.taskId });
    }
    const tasks = [];
    for (const link of links) {
      const task = await readTask(link.appId, link.taskId);
      if (
        task.appId !== link.appId ||
        (task.id ?? task.taskId) !== link.taskId ||
        !Number.isSafeInteger(task.generation) ||
        !Number.isSafeInteger(task.resourceVersion) ||
        !taskIsQuiet(task, now)
      )
        return no("owner-task-needs-consideration-or-is-unavailable");
      tasks.push({
        ...link,
        generation: task.generation,
        resourceVersion: task.resourceVersion,
      });
    }
    return {
      reusable: true,
      decision: {
        appId: row.appId,
        taskId: row.taskId,
        attemptId: row.attemptId,
        timestamp: row.timestamp,
        alertId: decision.alertId,
        scope,
        evidence: decision.evidence,
      },
      currentEnd: now,
      currentEvidenceHash: createHash("sha256")
        .update(JSON.stringify(current))
        .digest("hex"),
      tasks,
    };
  } catch {
    return no("reuse-evidence-unavailable");
  }
}
