import { type Condition as AppTaskConditionSpec, type TaskAppDependency } from "@may-agent/sdk";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Check } from "typebox/value";
import { getDb } from "../../../lib/db/connection.js";
import { EVENT_DELIVERY_RESULT, EVENT_ROW_ID } from "../events/bus.js";
import { appInputFeedbackEvent } from "../inbox/input-result.js";
import { getAppInboxItem, listOpenAppInboxItemsByIdempotencyPrefix } from "../state/app-inbox-store.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  matchesAppTaskCondition,
  matchingAppTaskConditionTaskIds,
  trackAppTaskConditionEventForTasks,
} from "./app-task-condition-tracker.js";
import { assertAppTaskEffectFresh, readAppTaskAdmissionOutcome, type AppTaskClaim } from "./app-task-reconciler.js";
import { type AppTaskContext } from "./app-task-store.js";
import { appTaskConfig, configuredRegistryEntries, type AppTaskRuntimeDescriptor } from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";

const APP_DEPENDENCY_REVIEW_AFTER_MS = 300_000;

export function admitTaskAppDependencies(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  dependencies: TaskAppDependency[];
  existingConditions?: AppTaskConditionSpec[];
  acceptedLiveEventIds?: number[];
}): AppTaskConditionSpec[] {
  const dependencyIds = new Set<string>();
  for (const dependency of input.dependencies) {
    if (dependencyIds.has(dependency.id)) {
      throw new Error(`Task result declares App dependency ${dependency.id} more than once`);
    }
    dependencyIds.add(dependency.id);
    assertInstalledAppDependency(input.opts, dependency);
  }

  const existing = (input.existingConditions ?? []).flatMap((condition) => {
    if (condition.type !== "app.dependency.updated" || !condition.id.startsWith("app-request:")) return [];
    const requestId = condition.subject.startsWith("id:") ? condition.subject.slice("id:".length) : "";
    if (!requestId || condition.id !== `app-request:${requestId}`) return [];
    const item = input.opts.persistDir ? getAppInboxItem(getDb(input.opts.persistDir), requestId) : null;
    return [{ condition, requestId, item }];
  });
  const matchedExisting = new Set<string>();
  const matches = new Map<string, (typeof existing)[number]>();
  const requestLineagePrefix = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:`;
  const detachedOpenByApp = new Map<string, ReturnType<typeof listOpenAppInboxItemsByIdempotencyPrefix>>();
  const detachedOpenFor = (appId: string) => {
    const cached = detachedOpenByApp.get(appId);
    if (cached) return cached;
    const items = input.opts.persistDir
      ? listOpenAppInboxItemsByIdempotencyPrefix(getDb(input.opts.persistDir), {
          appId,
          sourceAppId: input.descriptor.id,
          prefix: requestLineagePrefix,
        })
      : [];
    detachedOpenByApp.set(appId, items);
    return items;
  };
  const detachedMatch = (item: ReturnType<typeof detachedOpenFor>[number]) => ({
    requestId: item.id,
    item,
    condition: {
      id: `app-request:${item.id}`,
      type: "app.dependency.updated",
      subject: `id:${item.id}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${item.appId}`,
      reviewAfterMs: APP_DEPENDENCY_REVIEW_AFTER_MS,
    } satisfies AppTaskConditionSpec,
  });

  for (const dependency of input.dependencies) {
    const direct = existing.filter(
      ({ condition, requestId }) =>
        dependency.id === requestId || dependency.id === condition.id || dependency.id === `app-request:${requestId}`,
    );
    const exact = existing.filter(
      ({ item }) =>
        item &&
        item.appId === dependency.appId &&
        item.targetTaskId === dependency.taskId &&
        isDeepStrictEqual(item.input, dependency.input),
    );
    const detachedRequestId = dependency.id.replace(/^app-request:/, "");
    const detachedItem =
      direct.length === 0 && exact.length === 0 && input.opts.persistDir
        ? getAppInboxItem(getDb(input.opts.persistDir), detachedRequestId)
        : null;
    const detachedById =
      detachedItem &&
      detachedItem.status !== "done" &&
      detachedItem.source.kind === "app" &&
      detachedItem.source.id === input.descriptor.id &&
      detachedItem.idempotencyKey?.startsWith(requestLineagePrefix)
        ? [detachedMatch(detachedItem)]
        : [];
    const detachedByMeaning =
      direct.length === 0 && exact.length === 0 && detachedById.length === 0
        ? detachedOpenFor(dependency.appId)
            .filter(
              (item) => item.targetTaskId === dependency.taskId && isDeepStrictEqual(item.input, dependency.input),
            )
            .map(detachedMatch)
        : [];
    const candidates =
      direct.length > 0
        ? direct
        : exact.length > 0
          ? exact
          : detachedById.length > 0
            ? detachedById
            : detachedByMeaning;
    if (candidates.length > 1) {
      throw new Error(`App dependency ${dependency.id} ambiguously matches multiple open requests`);
    }
    const match = candidates[0];
    if (!match) continue;
    if (match.item && match.item.appId !== dependency.appId) {
      throw new Error(
        `App dependency ${dependency.id} refers to open request ${match.requestId} for App ${match.item.appId}, not ${dependency.appId}`,
      );
    }
    // A create-work request has no original targetTaskId. Once admitted, the
    // inbox records the Task it resolved to in waitingOn. Agents may echo that
    // observed Task while preserving the exact request ID; this is reuse, not
    // authority to retarget or create work.
    const resolvedCreatedTaskMatches = Boolean(
      match.item &&
      match.item.targetTaskId === undefined &&
      match.item.waitingOn?.kind === "task" &&
      match.item.waitingOn.id === dependency.taskId,
    );
    if (match.item && match.item.targetTaskId !== dependency.taskId && !resolvedCreatedTaskMatches) {
      throw new Error(
        `App dependency ${dependency.id} refers to open request ${match.requestId} for Task ${match.item.targetTaskId ?? "new work"}, not ${dependency.taskId ?? "new work"}`,
      );
    }
    if (matchedExisting.has(match.requestId)) {
      throw new Error(`Open App request ${match.requestId} is declared more than once`);
    }
    matchedExisting.add(match.requestId);
    matches.set(dependency.id, match);
  }

  const newDependencies = input.dependencies.filter((dependency) => !matches.has(dependency.id));
  for (const dependency of newDependencies) {
    const unresolvedExisting = existing.find(({ item, requestId }) => !item && !matchedExisting.has(requestId));
    if (unresolvedExisting) {
      throw new Error(
        `Cannot classify App dependency ${dependency.id} while open request ${unresolvedExisting.requestId} is unavailable`,
      );
    }
  }
  // New dependencies add work. Stored waits survive omission; asking the agent
  // to repeat them would turn continuation back into bookkeeping. Exact reuse,
  // duplicate checks and effect fencing still protect already admitted work.
  for (let index = 0; index < newDependencies.length; index += 1) {
    const dependency = newDependencies[index]!;
    const duplicate = newDependencies
      .slice(0, index)
      .find(
        (candidate) =>
          candidate.appId === dependency.appId &&
          candidate.taskId === dependency.taskId &&
          isDeepStrictEqual(candidate.input, dependency.input),
      );
    if (duplicate) {
      throw new Error(
        `App dependencies ${duplicate.id} and ${dependency.id} request the same ${dependency.appId} outcome`,
      );
    }
  }
  if (newDependencies.length > 0) {
    assertAppTaskEffectFresh(appTaskConfig(input.descriptor), input.claim, input.acceptedLiveEventIds);
  }

  const admitted = new Map<string, AppTaskConditionSpec>();
  for (const dependency of newDependencies) {
    const identity = createHash("sha256")
      .update(
        JSON.stringify({
          appId: input.descriptor.id,
          taskId: input.claim.taskId,
          generation: input.claim.generation,
          dependencyId: dependency.id,
          targetAppId: dependency.appId,
          targetTaskId: dependency.taskId,
          targetInput: dependency.input,
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const requestId = `appdep_${identity}`;
    const idempotencyKey = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:${dependency.id}:${identity}`;
    const requested = input.opts.bus.emit({
      type: "app.input.requested",
      source: `app-task:${input.descriptor.id}`,
      owner: `app:${dependency.appId}`,
      data: {
        requestId,
        appId: dependency.appId,
        ...(dependency.taskId ? { targetTaskId: dependency.taskId } : {}),
        input: dependency.input,
        source: { kind: "app", id: input.descriptor.id },
        idempotencyKey,
      },
    });
    const delivery = requested[EVENT_DELIVERY_RESULT];
    // A worker persists the input before the parent admits its relayed event.
    // Save the exact pending wait once publication is durable; a local receipt
    // is only available when admission runs in this process. Event recovery
    // can redeliver that same input if the worker/parent stops between them.
    if (!delivery && !requested[EVENT_ROW_ID]) {
      throw new Error(
        `App dependency ${dependency.id} was neither admitted nor durably published for App ${dependency.appId}; the Task remains runnable`,
      );
    }
    admitted.set(dependency.id, {
      id: `app-request:${requestId}`,
      type: "app.dependency.updated",
      subject: `id:${requestId}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${dependency.appId}`,
      reviewAfterMs: APP_DEPENDENCY_REVIEW_AFTER_MS,
    });
  }

  return input.dependencies.map((dependency) => {
    const condition = matches.get(dependency.id)?.condition ?? admitted.get(dependency.id)!;
    return {
      ...condition,
      owner: condition.owner ?? `app:${dependency.appId}`,
      reviewAfterMs: condition.reviewAfterMs ?? APP_DEPENDENCY_REVIEW_AFTER_MS,
    };
  });
}

export function openTaskAppDependencyConditions(config: AppTaskContext, taskId: string): AppTaskConditionSpec[] {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  return (resource?.status.conditionIds ?? []).flatMap((conditionId) => {
    const condition = tree.conditions?.[conditionId];
    if (!condition || condition.status.state === "true" || condition.spec.type !== "app.dependency.updated") {
      return [];
    }
    return [{ id: condition.metadata.id, ...structuredClone(condition.spec) }];
  });
}

export function mergeTaskConditions(
  conditions: AppTaskConditionSpec[],
  authoritativeIds: ReadonlySet<string> = new Set(),
): AppTaskConditionSpec[] {
  const merged = new Map<string, AppTaskConditionSpec>();
  for (const condition of conditions) {
    const current = merged.get(condition.id);
    if (current && !isDeepStrictEqual(current, condition)) {
      // Persisted Conditions are the reconciliation authority. An executor may
      // echo different advisory metadata from its bounded prompt, but the
      // observable identity must still match. Retargeting the subject, type, or
      // expected fact remains a conflict rather than silently changing a wait.
      if (
        authoritativeIds.has(condition.id) &&
        current.type === condition.type &&
        current.subject === condition.subject &&
        isDeepStrictEqual(current.expected, condition.expected)
      ) {
        continue;
      }
      throw new Error(`Task result conflicts with existing Condition ${condition.id}`);
    }
    merged.set(condition.id, condition);
  }
  return [...merged.values()];
}

function assertInstalledAppDependency(opts: AppTaskRuntimeOptions, dependency: TaskAppDependency): void {
  const registryConfigured = Boolean(opts.appRegistrySnapshot || opts.appRegistry);
  if (!registryConfigured) return;
  const entries = configuredRegistryEntries(opts);
  const target = entries.find(({ definition }) => definition.id === dependency.appId)?.definition;
  if (!target?.task || !target.tasks) {
    throw new Error(`App dependency ${dependency.id} targets unavailable App ${dependency.appId}`);
  }
  if (!Check(target.inputSchema, dependency.input)) {
    throw new Error(`App dependency ${dependency.id} input is not accepted by installed App ${dependency.appId}`);
  }
}

export function recoverTaskConditions(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: AppTaskContext,
  input: { conditionIds?: string[] } = {},
): string[] {
  if (!opts.persistDir) return [];
  const resourceScope = config.resourceStore.readOpenConditionReplayScope(input.conditionIds);
  const eventTypes = resourceScope.eventTypes;
  if (eventTypes.length === 0) return [];

  const placeholders = eventTypes.map(() => "?").join(", ");
  const db = getDb(opts.persistDir);
  const rows = db
    .prepare(
      `SELECT event_type, source, timestamp, data
       FROM events
       WHERE (
         project_id = ?
         OR (
           json_valid(data) = 1
           AND (
             json_extract(data, '$.project') = ?
             OR json_extract(data, '$.target.project') = ?
           )
         )
       )
         AND event_type IN (${placeholders})
       ORDER BY id DESC
       LIMIT 2000`,
    )
    .all(descriptor.id, descriptor.id, descriptor.id, ...eventTypes) as Array<{
    event_type?: unknown;
    source?: unknown;
    timestamp?: unknown;
    data?: unknown;
  }>;

  const events: Record<string, unknown>[] = [];
  for (const row of rows.reverse()) {
    if (typeof row.data !== "string" || !row.data.trim()) continue;
    try {
      const parsed = JSON.parse(row.data);
      if (!isRecord(parsed)) continue;
      const event: Record<string, unknown> = {
        ...parsed,
        type: typeof row.event_type === "string" ? row.event_type : parsed.type,
        ...(typeof row.source === "string" && row.source.trim() ? { source: row.source } : {}),
        ...(typeof row.timestamp === "number" ? { timestamp: row.timestamp } : {}),
      };
      events.push(event);
    } catch {
      // Ignore malformed persisted events; they cannot prove a Condition.
    }
  }

  // A feedback notification can be lost before it reaches the journal.
  // Read each wait's exact saved answer or selected report, not a later Task result.
  // Use the normal Condition transition and trigger.
  const allowed = new Set(resourceScope.taskIds);
  const recoveredTaskIds = new Set<string>();
  if (eventTypes.includes("app.dependency.updated")) {
    for (const { condition, taskIds } of config.resourceStore.readConditionRoutes("app.dependency.updated")) {
      if (input.conditionIds && !input.conditionIds.includes(condition.metadata.id)) continue;
      if (!condition.spec.subject.startsWith("id:")) continue;
      const item = getAppInboxItem(db, condition.spec.subject.slice(3));
      if (!item || item.source.kind !== "app" || item.source.id !== descriptor.id) continue;
      const source = AppTaskResourceStore.activeFromDb(db, item.appId);
      const report =
        item.status !== "done" &&
        item.taskAdmissionKey &&
        item.waitingOn?.kind === "task" &&
        source &&
        !source.isCancelled(item.waitingOn.id)
          ? readAppTaskAdmissionOutcome({ resourceStore: source }, item.waitingOn.id, item.taskAdmissionKey, "report")
          : null;
      const result = item.status === "done" ? item.result : report;
      if (!result) continue;
      const event = appInputFeedbackEvent(item, result, item.status === "done" ? "done" : "blocked")!;
      if (!matchesAppTaskCondition(condition, event)) continue;
      for (const wake of trackAppTaskConditionEventForTasks(
        config,
        event,
        taskIds.filter((id) => allowed.has(id)),
      ))
        recoveredTaskIds.add(wake.taskId);
    }
  }
  const wakes = events.flatMap((event) => {
    const taskIds = matchingAppTaskConditionTaskIds(config, event).filter((taskId) => allowed.has(taskId));
    return trackAppTaskConditionEventForTasks(config, event, taskIds);
  });
  return [...new Set([...recoveredTaskIds, ...wakes.map((wake) => wake.taskId)])];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
