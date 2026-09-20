import { createHash } from "node:crypto";
import type { ResourceCreator } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { advanceTaskResourceRevision } from "../../../lib/db/task-resource-schema.js";
import type { AppTaskResource } from "../tasks/app-task-state.js";

export type LegacyTaskCreatorManifestEntry = {
  appId: string;
  taskId: string;
  expectedGeneration: number;
  expectedResourceVersion: number;
  legacySpecHash: string;
  /** Reviewed historical evidence retained with the private manifest; never authority. */
  provenance: Record<string, unknown>;
};

export type LegacyTaskCreatorManifest = {
  schemaVersion: 1;
  appId: string;
  expectedEntryCount: number;
  creator: ResourceCreator;
  entries: LegacyTaskCreatorManifestEntry[];
};

export type LegacyTaskCreatorInitializationResult = {
  status: "would-initialize" | "initialized" | "already-initialized";
  appId: string;
  initializedCount: number;
  alreadyInitializedCount: number;
  entries: Array<{
    taskId: string;
    generation: number;
    legacyResourceVersion: number;
    resultingResourceVersion: number;
    legacySpecHash: string;
  }>;
};

class DryRunRollback extends Error {
  constructor(readonly result: LegacyTaskCreatorInitializationResult) {
    super("Dry-run rollback");
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

/** Hash the complete retained legacy spec without deriving an actor or authority. */
export function legacyTaskSpecHash(spec: AppTaskResource["spec"]): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(spec)))
    .digest("hex");
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty`);
  return value;
}

function positiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${field} must be a positive safe integer`);
}

function validateManifest(manifest: LegacyTaskCreatorManifest): void {
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported creator initialization manifest schema");
  required(manifest.appId, "appId");
  positiveInteger(manifest.expectedEntryCount, "expectedEntryCount");
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== manifest.expectedEntryCount)
    throw new Error("Creator initialization manifest has missing or extra entries");
  if (!manifest.creator || manifest.creator.appId !== manifest.appId || manifest.creator.taskId !== undefined)
    throw new Error("Creator initialization requires the exact App-only creator");
  const ids = new Set<string>();
  for (const [index, entry] of manifest.entries.entries()) {
    required(entry.appId, `entries[${index}].appId`);
    required(entry.taskId, `entries[${index}].taskId`);
    if (entry.appId !== manifest.appId) throw new Error(`Manifest entry ${entry.taskId} belongs to another App`);
    if (ids.has(entry.taskId)) throw new Error(`Duplicate creator initialization Task ${entry.taskId}`);
    ids.add(entry.taskId);
    positiveInteger(entry.expectedGeneration, `entries[${index}].expectedGeneration`);
    positiveInteger(entry.expectedResourceVersion, `entries[${index}].expectedResourceVersion`);
    if (!/^[a-f0-9]{64}$/.test(entry.legacySpecHash))
      throw new Error(`entries[${index}].legacySpecHash must be a lowercase SHA-256 digest`);
    if (!entry.provenance || typeof entry.provenance !== "object" || Array.isArray(entry.provenance))
      throw new Error(`entries[${index}].provenance must be retained manifest data`);
  }
}

type TaskRow = {
  app_id: string;
  task_id: string;
  generation: number;
  resource_version: number;
  phase: string;
  current_attempt_id: string | null;
  resource_json: string;
};

/**
 * One-time offline metadata initialization. The caller is responsible for
 * stopping the Host and every worker; this helper additionally rejects any
 * retained running evidence and fences the complete reviewed batch.
 */
export function initializeLegacyTaskCreators(
  db: SqliteDb,
  manifest: LegacyTaskCreatorManifest,
  options: { hostAndWorkersStopped: true; dryRun?: boolean },
): LegacyTaskCreatorInitializationResult {
  if (options?.hostAndWorkersStopped !== true)
    throw new Error("Creator initialization requires explicit stopped Host and workers acknowledgement");
  validateManifest(manifest);
  const taskIds = manifest.entries.map((entry) => entry.taskId).sort();

  try {
    return stateTransaction(db, () => {
      const authority = db
        .prepare("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'")
        .get(manifest.appId) as { value?: string } | null;
      if (authority?.value !== "resources") throw new Error(`App ${manifest.appId} does not use active Task resources`);
      const rows = db
        .prepare(
          `SELECT app_id, task_id, generation, resource_version, phase, current_attempt_id, resource_json
           FROM app_tasks WHERE app_id = ? AND task_id IN (${taskIds.map(() => "?").join(", ")})
           ORDER BY task_id`,
        )
        .all(manifest.appId, ...taskIds) as TaskRow[];
      if (rows.length !== taskIds.length) throw new Error("A manifested Task is missing");
      const byId = new Map(rows.map((row) => [row.task_id, row]));
      let absent = 0;
      let replay = 0;
      const replacements: Array<{ entry: LegacyTaskCreatorManifestEntry; row: TaskRow; resource: AppTaskResource }> =
        [];

      for (const entry of manifest.entries) {
        const row = byId.get(entry.taskId);
        if (!row || row.app_id !== entry.appId)
          throw new Error(`Manifested Task ${entry.taskId} is missing or mismatched`);
        const resource = JSON.parse(row.resource_json) as AppTaskResource;
        if (
          resource.metadata.id !== entry.taskId ||
          resource.metadata.generation !== row.generation ||
          resource.metadata.resourceVersion !== row.resource_version
        )
          throw new Error(`Task ${entry.taskId} row bookkeeping conflicts with its resource`);
        if (
          row.phase === "running" ||
          row.current_attempt_id !== null ||
          resource.status.currentAttemptId !== undefined
        )
          throw new Error(`Task ${entry.taskId} is running`);
        const runningAttempt = db
          .prepare("SELECT 1 FROM app_task_attempts WHERE app_id = ? AND task_id = ? AND state = 'running' LIMIT 1")
          .get(entry.appId, entry.taskId);
        if (runningAttempt) throw new Error(`Task ${entry.taskId} retains a running attempt`);
        if (row.generation !== entry.expectedGeneration)
          throw new Error(`Task ${entry.taskId} generation changed from its manifest pin`);
        if (legacyTaskSpecHash(resource.spec) !== entry.legacySpecHash)
          throw new Error(`Task ${entry.taskId} legacy spec changed from its manifest pin`);

        const creator = resource.metadata.creator;
        if (creator === undefined && row.resource_version === entry.expectedResourceVersion) absent += 1;
        else if (
          creator?.appId === manifest.creator.appId &&
          creator.taskId === undefined &&
          row.resource_version === entry.expectedResourceVersion + 1
        )
          replay += 1;
        else if (creator?.taskId !== undefined) throw new Error(`Task ${entry.taskId} has a conflicting Task creator`);
        else if (creator !== undefined) throw new Error(`Task ${entry.taskId} has a conflicting creator`);
        else throw new Error(`Task ${entry.taskId} resource version changed from its manifest pin`);
        replacements.push({ entry, row, resource });
      }

      if (absent && replay) throw new Error("Creator initialization batch is partially applied");
      const receiptEntries = manifest.entries
        .map((entry) => ({
          taskId: entry.taskId,
          generation: entry.expectedGeneration,
          legacyResourceVersion: entry.expectedResourceVersion,
          resultingResourceVersion: entry.expectedResourceVersion + 1,
          legacySpecHash: entry.legacySpecHash,
        }))
        .sort((left, right) => left.taskId.localeCompare(right.taskId));
      if (replay === manifest.entries.length) {
        return {
          status: "already-initialized",
          appId: manifest.appId,
          initializedCount: 0,
          alreadyInitializedCount: replay,
          entries: receiptEntries,
        };
      }
      if (absent !== manifest.entries.length) throw new Error("Creator initialization batch state is inconsistent");

      for (const { entry, resource } of replacements) {
        const next: AppTaskResource = {
          ...resource,
          metadata: {
            ...resource.metadata,
            creator: { appId: manifest.creator.appId },
            resourceVersion: entry.expectedResourceVersion + 1,
          },
        };
        const update = db
          .prepare(
            `UPDATE app_tasks SET resource_version = ?, resource_json = ?
             WHERE app_id = ? AND task_id = ? AND generation = ? AND resource_version = ?
               AND current_attempt_id IS NULL AND phase <> 'running'`,
          )
          .run(
            next.metadata.resourceVersion,
            JSON.stringify(stableValue(next)),
            entry.appId,
            entry.taskId,
            entry.expectedGeneration,
            entry.expectedResourceVersion,
          );
        if (update.changes !== 1) throw new Error(`Task ${entry.taskId} changed during creator initialization`);
      }
      advanceTaskResourceRevision(db, manifest.appId);
      const result: LegacyTaskCreatorInitializationResult = {
        status: options.dryRun ? "would-initialize" : "initialized",
        appId: manifest.appId,
        initializedCount: options.dryRun ? 0 : absent,
        alreadyInitializedCount: 0,
        entries: receiptEntries,
      };
      if (options.dryRun) throw new DryRunRollback(result);
      return result;
    });
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result;
    throw error;
  }
}
