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

/** Immutable admission identity; returned results arrive as Task input, not a second inbox wait. */
export function readInputContext(db: SqliteDb, item: AppInboxItem): Readonly<AppInputContext> {
  const parent = item.parentId ? getAppInboxItem(db, item.parentId) : null;
  return freezeInputContext({
    id: item.id,
    source: item.source,
    ...(item.source.kind === "human" || parent?.source.kind === "human" ? { humanRequested: true as const } : {}),
    parentId: item.parentId,
    input: item.input,
  });
}
