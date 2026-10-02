import { type Condition as AppTaskConditionSpec, type TaskAppRequest } from "@may-agent/sdk";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { assertValidAppInput } from "../apps/definition-validation.js";
import { assertAppTaskInputRoute } from "../apps/input-routing.js";
import { getDb } from "../../../lib/db/connection.js";
import { EVENT_DELIVERY_RESULT, EVENT_ROW_ID } from "../events/bus.js";
import { appInputFeedbackEvent } from "../inbox/input-result.js";
import {
  createAppInboxItem,
  getAppInboxItem,
  listOpenAppInboxItemsByIdempotencyPrefix,
  listAppInboxItemsByIdempotencyPrefix,
} from "../state/app-inbox-store.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
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

function taskRequestIdentity(appId: string, claim: Pick<AppTaskClaim, "taskId" | "generation">, id: string) {
  return createHash("sha256")
    .update(JSON.stringify([appId, claim.taskId, claim.generation, id]))
    .digest("hex")
    .slice(0, 24);
}

function readNamedTaskRequest(config: AppTaskContext, claim: AppTaskClaim, id: string) {
  const appId = config.resourceStore.appId;
  const prefix = `task-dependency:${appId}:${claim.taskId}:${claim.generation}:`;
  const stable = getAppInboxItem(config.resourceStore.db, `appdep_${taskRequestIdentity(appId, claim, id)}`);
  const savedId = config.resourceStore.readTaskRequestReceipt(claim.taskId, claim.generation, id);
  const saved = savedId ? getAppInboxItem(config.resourceStore.db, savedId) : null;
  const exact = stable ?? saved ?? getAppInboxItem(config.resourceStore.db, id.replace(/^app-request:/, ""));
  if (
    exact &&
    exact.source.kind === "app" &&
    exact.source.id === appId &&
    (saved || exact.idempotencyKey?.startsWith(prefix)) &&
    (!exact.creator || isDeepStrictEqual(exact.creator, { appId, taskId: claim.taskId }))
  )
    return exact;
  const namedPrefix = `${prefix}${id}:`;
  const legacy = listAppInboxItemsByIdempotencyPrefix(config.resourceStore.db, appId, namedPrefix).filter(
    (item) =>
      /^[a-f0-9]{24}$/.test(item.idempotencyKey!.slice(namedPrefix.length)) &&
      (!item.creator || isDeepStrictEqual(item.creator, { appId, taskId: claim.taskId })),
  );
  if (legacy.length > 1)
    throw new Error(`Request ${id} has ambiguous historical identity; use its exact durable request id`);
  return legacy[0] ?? null;
}

function requestCompletionCondition(item: NonNullable<ReturnType<typeof getAppInboxItem>>): AppTaskConditionSpec {
  return {
    id: `app-request:${item.id}`,
    type: "app.dependency.updated",
    subject: `id:${item.id}`,
    expected: { field: "status", equals: "done" },
    owner: `app:${item.appId}`,
  };
}

/** Short references may name an exact earlier admission in the current caller generation. */
export function resolveTaskRequestCondition(
  config: AppTaskContext,
  claim: AppTaskClaim,
  id: string,
): AppTaskConditionSpec {
  const item = readNamedTaskRequest(config, claim, id);
  if (!item) throw new Error(`Condition refers to undeclared request ${id}`);
  return requestCompletionCondition(item);
}

/** Submit once and return exact completion specifications; only the caller's Conditions install waits. */
export function admitTaskAppRequests(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  requests: TaskAppRequest[];
  existingConditions?: AppTaskConditionSpec[];
  acceptedLiveEventIds?: number[];
  deferPublication?: (publish: () => void) => void;
}): Map<string, AppTaskConditionSpec> {
  const dependencyIds = new Set<string>();
  for (const dependency of input.requests) {
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
  const requestLineagePrefix = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:`;
  const belongsToCaller = (item: NonNullable<ReturnType<typeof getAppInboxItem>>) =>
    item.creator
      ? isDeepStrictEqual(item.creator, { appId: input.descriptor.id, taskId: input.claim.taskId })
      : Boolean(item.idempotencyKey?.startsWith(`${requestLineagePrefix}${input.claim.generation}:`));
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
    const owned = items.filter(belongsToCaller);
    detachedOpenByApp.set(appId, owned);
    return owned;
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
    } satisfies AppTaskConditionSpec,
  });

  for (const dependency of input.requests) {
    const named = readNamedTaskRequest(appTaskConfig(input.descriptor), input.claim, dependency.id);
    if (named) {
      if (
        named.appId !== dependency.appId ||
        (named.targetTaskId !== dependency.taskId &&
          !(
            named.targetTaskId === undefined &&
            named.waitingOn?.kind === "task" &&
            named.waitingOn.id === dependency.taskId
          )) ||
        (![named.id, `app-request:${named.id}`].includes(dependency.id) &&
          !isDeepStrictEqual(named.input, dependency.input))
      )
        throw new Error(`Request ${dependency.id} was already admitted with different input or target`);
      matches.set(dependency.id, { item: named, requestId: named.id, condition: requestCompletionCondition(named) });
      matchedExisting.add(named.id);
      continue;
    }
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
      detachedItem.idempotencyKey?.startsWith(requestLineagePrefix) &&
      belongsToCaller(detachedItem)
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

  const newDependencies = input.requests.filter((dependency) => !matches.has(dependency.id));
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
    const identity = taskRequestIdentity(input.descriptor.id, input.claim, dependency.id);
    const requestId = `appdep_${identity}`;
    const idempotencyKey = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:${dependency.id}:${identity}`;
    // The row is admission authority; the event only wakes ordinary admission.
    // Persist provenance from the live claim, never reconstruct it from event text.
    const config = appTaskConfig(input.descriptor);
    stateTransaction(config.resourceStore.db, () => {
      assertAppTaskEffectFresh(config, input.claim, input.acceptedLiveEventIds);
      createAppInboxItem(config.resourceStore.db, {
        id: requestId,
        appId: dependency.appId,
        targetTaskId: dependency.taskId,
        source: { kind: "app", id: input.descriptor.id },
        input: dependency.input,
        creator: { appId: input.descriptor.id, taskId: input.claim.taskId },
        idempotencyKey,
      });
    });
    const publish = () => {
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
      // Shared admission committed the request and caller wait before dispatch.
      // Inbox recovery can deliver it even if this hint is lost. The legacy
      // direct helper still requires an observable delivery receipt.
      if (!input.deferPublication && !delivery && !requested[EVENT_ROW_ID]) {
        throw new Error(
          `App dependency ${dependency.id} was neither admitted nor durably published for App ${dependency.appId}; the Task remains runnable`,
        );
      }
    };
    if (input.deferPublication) input.deferPublication(publish);
    else publish();
    admitted.set(dependency.id, {
      id: `app-request:${requestId}`,
      type: "app.dependency.updated",
      subject: `id:${requestId}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${dependency.appId}`,
    });
  }

  return new Map(
    input.requests.map((dependency) => {
      const condition = matches.get(dependency.id)?.condition ?? admitted.get(dependency.id)!;
      return [
        dependency.id,
        {
          ...condition,
          owner: condition.owner ?? `app:${dependency.appId}`,
        },
      ];
    }),
  );
}

export function linkedTaskAppDependencyConditions(
  config: AppTaskContext,
  taskId: string,
): { all: AppTaskConditionSpec[]; unfinished: AppTaskConditionSpec[] } {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  const all: AppTaskConditionSpec[] = [];
  const unfinished: AppTaskConditionSpec[] = [];
  for (const conditionId of resource?.status.conditionIds ?? []) {
    const condition = tree.conditions?.[conditionId];
    if (!condition || condition.spec.type !== "app.dependency.updated") continue;
    const spec = { id: condition.metadata.id, ...structuredClone(condition.spec) };
    all.push(spec);
    if (condition.status.state !== "true") unfinished.push(spec);
  }
  return { all, unfinished };
}

export function mergeTaskConditions(
  conditions: AppTaskConditionSpec[],
  compatibleUpdateIds: ReadonlySet<string> = new Set(),
): AppTaskConditionSpec[] {
  const merged = new Map<string, AppTaskConditionSpec>();
  for (const condition of conditions) {
    const current = merged.get(condition.id);
    if (current && !isDeepStrictEqual(current, condition)) {
      // Persisted/generated dependency Conditions retain identity authority,
      // while a later explicit declaration may replace their complete
      // compatible specification. Retargeting identity remains a conflict.
      if (
        compatibleUpdateIds.has(condition.id) &&
        current.type === condition.type &&
        current.subject === condition.subject &&
        isDeepStrictEqual(current.expected, condition.expected)
      ) {
        merged.set(condition.id, condition);
        continue;
      }
      throw new Error(`Task result conflicts with existing Condition ${condition.id}`);
    }
    merged.set(condition.id, condition);
  }
  return [...merged.values()];
}

function assertInstalledAppDependency(opts: AppTaskRuntimeOptions, dependency: TaskAppRequest): void {
  const registryConfigured = Boolean(opts.appRegistrySnapshot || opts.appRegistry);
  if (!registryConfigured) return;
  const entries = configuredRegistryEntries(opts);
  const target = entries.find(({ definition }) => definition.id === dependency.appId)?.definition;
  if (!target?.task || !target.tasks) {
    throw new Error(`App dependency ${dependency.id} targets unavailable App ${dependency.appId}`);
  }
  assertValidAppInput(target, dependency.input);
  assertAppTaskInputRoute(target, dependency.input.kind, dependency.taskId);
}

export function recoverTaskConditions(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: AppTaskContext,
  input: { conditionIds?: string[]; taskId?: string } = {},
): string[] {
  if (!opts.persistDir) return [];
  const conditionIds = input.taskId
    ? config.resourceStore.readTaskConditions(input.taskId).map((condition) => condition.metadata.id)
    : input.conditionIds;
  if (conditionIds?.length === 0) return [];
  const resourceScope = config.resourceStore.readOpenConditionReplayScope(conditionIds);
  const eventTypes = resourceScope.eventTypes;
  if (eventTypes.length === 0) return [];

  const placeholders = eventTypes.map(() => "?").join(", ");
  const db = getDb(opts.persistDir);
  const rows = db
    .prepare(
      `SELECT id, event_type, source, timestamp, data
       FROM events
       WHERE (
         project_id = ?
         OR owner = ?
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
    .all(descriptor.id, `app:${descriptor.id}`, descriptor.id, descriptor.id, ...eventTypes) as Array<{
    id: number;
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
        eventId: row.id,
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
      if (conditionIds && !conditionIds.includes(condition.metadata.id)) continue;
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
