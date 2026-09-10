import type { AppInputContext, AppDependencyObservation, AppRequestDependencyObservation } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { getAppInboxItem, listAppInboxChildren, type AppInboxItem } from "../../app-inbox-store.js";
import { appRequestChildrenWaitId } from "../state/inbox.js";

export type AppDependencyReader = (input: {
  appId: string;
  dependency: { kind: "task"; id: string };
}) => Promise<AppDependencyObservation | null>;

export function freezeInputContext<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeInputContext(nested);
  return Object.freeze(value);
}

export async function observeTaskDependency(
  readDependency: AppDependencyReader | undefined,
  appId: string,
  dependency: { kind: "task"; id: string },
): Promise<AppDependencyObservation | null> {
  const observed = await readDependency?.({ appId, dependency });
  if (observed && (observed.kind !== dependency.kind || observed.id !== dependency.id)) {
    throw new Error(`Dependency reader returned a mismatched observation for ${dependency.kind}:${dependency.id}`);
  }
  return observed ?? null;
}

export async function requestDependencyObservation(
  readDependency: AppDependencyReader | undefined,
  child: AppInboxItem,
): Promise<AppRequestDependencyObservation> {
  if (child.waitingOn?.kind === "task") {
    const observed = (await observeTaskDependency(readDependency, child.appId, {
      kind: "task",
      id: child.waitingOn.id,
    })) ?? { kind: "task" as const, id: child.waitingOn.id, status: "unknown" as const };
    return {
      ...observed,
      requestId: child.id,
      appId: child.appId,
      taskId: child.waitingOn.id,
      input: child.input,
    };
  }
  return {
    kind: "app",
    id: child.id,
    requestId: child.id,
    appId: child.appId,
    ...(child.targetTaskId ? { taskId: child.targetTaskId } : {}),
    status:
      child.status === "done" ? "done" : child.status === "pending" ? "pending" : child.lease ? "running" : "waiting",
    summary: child.result?.summary,
    response: child.result?.response,
    result: child.result?.result,
    evidence: child.result?.evidence,
    input: child.input,
  };
}

/** Input identity and exact caller/Task observations; no conversational context selection. */
export async function readInputContext(
  db: SqliteDb,
  item: AppInboxItem,
  readDependency?: AppDependencyReader,
): Promise<AppInputContext> {
  const parent = item.parentId ? getAppInboxItem(db, item.parentId) : null;
  const request: AppInputContext = {
    id: item.id,
    source: item.source,
    ...(item.source.kind === "human" || parent?.source.kind === "human" ? { humanRequested: true } : {}),
    parentId: item.parentId,
    input: item.input,
  };
  const childRequests = listAppInboxChildren(db, item.id);
  if (childRequests.length > 0) {
    request.dependencies = await Promise.all(
      childRequests.map((child) => requestDependencyObservation(readDependency, child)),
    );
  }
  const waitingOn = item.waitingOn;
  if (!waitingOn) return freezeInputContext(request);

  if (waitingOn.kind === "app" && waitingOn.id === appRequestChildrenWaitId(item.id)) {
    return freezeInputContext(request);
  }

  if (waitingOn.kind === "app") {
    const child = getAppInboxItem(db, waitingOn.id);
    request.dependency = child
      ? {
          kind: "app",
          id: child.id,
          status:
            child.status === "done"
              ? "done"
              : child.status === "pending"
                ? "pending"
                : child.lease
                  ? "running"
                  : "waiting",
          summary: child.result?.summary,
          response: child.result?.response,
          result: child.result?.result,
          evidence: child.result?.evidence,
        }
      : { kind: "app", id: waitingOn.id, status: "unknown" };
    return freezeInputContext(request);
  }

  // Legacy session/analysis waits are not part of the Task-only contract.
  // If an old terminal Event wakes one, reclaim the request as fresh Task work.
  if (waitingOn.kind !== "task") return freezeInputContext(request);
  const dependency = { kind: "task", id: waitingOn.id } as const;

  const observed = await observeTaskDependency(readDependency, item.appId, dependency);
  request.dependency = observed ?? { ...dependency, status: "unknown" };
  return freezeInputContext(request);
}
