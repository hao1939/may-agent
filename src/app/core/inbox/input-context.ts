import type { AppInputContext, AppDependencyObservation } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { getAppInboxItem, type AppInboxItem } from "../state/app-inbox-store.js";

export type AppDependencyReader = (input: {
  appId: string;
  dependency: { kind: "task"; id: string };
  admissionKey?: string;
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
  admissionKey?: string,
): Promise<AppDependencyObservation | null> {
  const observed = await readDependency?.({ appId, dependency, ...(admissionKey ? { admissionKey } : {}) });
  if (observed && (observed.kind !== dependency.kind || observed.id !== dependency.id)) {
    throw new Error(`Dependency reader returned a mismatched observation for ${dependency.kind}:${dependency.id}`);
  }
  return observed ?? null;
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
  const waitingOn = item.waitingOn;
  if (!waitingOn) return freezeInputContext(request);

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

  const observed = await observeTaskDependency(readDependency, item.appId, dependency, item.taskAdmissionKey);
  request.dependency = observed ?? { ...dependency, status: "unknown" };
  return freezeInputContext(request);
}
