import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  migrateTaskState,
  projectRuntimePaths,
  setProjectLifecycle,
  type ProjectAppTaskResource,
  type TaskCompletionReceipt,
  type TaskStateConfig,
  type TaskTree,
} from "@may-agent/sdk";

const workflow = "master-validation-failure";
const prefix = "domain/master-validation-failure/";

type Carrier = {
  id: string;
  resource: ProjectAppTaskResource;
  specId: string;
};

export type FailureCarrierMigrationStats = {
  specsConsolidated: number;
  resourcesRenamed: number;
  resourcesAbsorbed: number;
  receiptsCreated: number;
  attemptsRemoved: number;
  dependenciesRetargeted: number;
  conditionsRemoved: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeTaskIdPart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized === value.trim() && normalized.length <= 96) return normalized;
  const digest = createHash("sha256")
    .update(value.trim())
    .digest("hex")
    .slice(0, 12);
  return `${normalized.slice(0, 83) || "spec"}-${digest}`;
}

export function masterValidationFailureTaskId(specId: string): string {
  return `${prefix}${safeTaskIdPart(specId)}`;
}

function carrierRows(tree: TaskTree): Carrier[] {
  return Object.entries(tree.resources ?? {}).flatMap(([id, resource]) => {
    if (resource.spec.workflow !== workflow) return [];
    const specId = text(record(resource.spec.input).specId);
    if (!specId) throw new Error(`Failure carrier ${id} has no specId`);
    return [{ id, resource, specId }];
  });
}

function rank(carriers: Carrier[]): Carrier[] {
  return [...carriers].sort((left, right) => {
    const leftUpdated = Date.parse(left.resource.status.updatedAt);
    const rightUpdated = Date.parse(right.resource.status.updatedAt);
    return (
      (Number.isFinite(rightUpdated) ? rightUpdated : 0) -
        (Number.isFinite(leftUpdated) ? leftUpdated : 0) ||
      right.resource.metadata.generation - left.resource.metadata.generation ||
      right.resource.metadata.resourceVersion -
        left.resource.metadata.resourceVersion ||
      left.id.localeCompare(right.id)
    );
  });
}

function receiptFor(
  tree: TaskTree,
  carrier: Carrier,
  canonicalId: string,
  completedAt: string,
): TaskCompletionReceipt {
  const { resource } = carrier;
  const input = record(resource.spec.input);
  const evidence = [...(resource.status.evidence ?? [])];
  const latestAttempt = Object.values(tree.attempts ?? {})
    .filter((attempt) => attempt.taskId === carrier.id)
    .sort((left, right) =>
      String(right.finishedAt ?? right.startedAt).localeCompare(
        String(left.finishedAt ?? left.startedAt),
      ),
    )[0];
  return {
    metadata: {
      id: carrier.id,
      generation: resource.metadata.generation,
      resourceVersion: 1,
    },
    specHash: createHash("sha256")
      .update(JSON.stringify(resource.spec))
      .digest("hex"),
    parentId: resource.spec.parentId,
    outcome: resource.spec.outcome,
    acceptance: [...resource.spec.acceptance],
    owner: resource.spec.owner ?? "aks-explorer",
    workflow,
    handler: `workflow:${workflow}`,
    summary: `Historical failure carrier absorbed into ${canonicalId}; unresolved current work continues on the canonical spec task.`,
    evidence,
    acceptanceBasis: { method: "owner-judgment", evidence },
    failureFingerprints: [text(input.failureFingerprint)].filter(Boolean),
    completedAt,
    ...(latestAttempt?.workspace
      ? { workspace: structuredClone(latestAttempt.workspace) }
      : {}),
  };
}

function retargetTrigger(
  trigger: NonNullable<TaskTree["taskTriggers"]>[string],
  from: string,
  to: string,
): NonNullable<TaskTree["taskTriggers"]>[string] {
  const next = structuredClone(trigger);
  const event = record(next.event);
  for (const key of ["taskId", "task_id"]) {
    if (event[key] === from) event[key] = to;
  }
  const target = record(event.target);
  if (target.taskId === from) target.taskId = to;
  if (Object.keys(target).length > 0) event.target = target;
  next.event = event;
  return next;
}

export function migrateMasterValidationFailureCarriers(
  tree: TaskTree,
  now = new Date().toISOString(),
): FailureCarrierMigrationStats {
  const stats: FailureCarrierMigrationStats = {
    specsConsolidated: 0,
    resourcesRenamed: 0,
    resourcesAbsorbed: 0,
    receiptsCreated: 0,
    attemptsRemoved: 0,
    dependenciesRetargeted: 0,
    conditionsRemoved: 0,
  };
  const groups = new Map<string, Carrier[]>();
  const canonicalByOldId = new Map<string, string>();
  const removedConditionIds = new Set<string>();
  for (const carrier of carrierRows(tree)) {
    const group = groups.get(carrier.specId) ?? [];
    group.push(carrier);
    groups.set(carrier.specId, group);
  }

  for (const [specId, carriers] of groups) {
    const canonicalId = masterValidationFailureTaskId(specId);
    for (const carrier of carriers)
      canonicalByOldId.set(carrier.id, canonicalId);
    const selected = rank(carriers)[0]!;
    const unrelatedCanonical = tree.resources?.[canonicalId];
    if (
      unrelatedCanonical &&
      !carriers.some((carrier) => carrier.id === canonicalId)
    ) {
      throw new Error(
        `Canonical task ${canonicalId} already exists outside its carrier set`,
      );
    }
    for (const carrier of carriers) {
      if (carrier.resource.status.currentAttemptId) {
        throw new Error(`Carrier ${carrier.id} still has a current attempt`);
      }
    }

    const oldIds = new Set(carriers.map((carrier) => carrier.id));
    for (const resource of Object.values(tree.resources ?? {})) {
      if (!resource.spec.dependsOn?.some((id) => oldIds.has(id))) continue;
      resource.spec.dependsOn = [
        ...new Set(
          resource.spec.dependsOn.map((id) =>
            oldIds.has(id) ? canonicalId : id,
          ),
        ),
      ];
      resource.metadata.resourceVersion += 1;
      stats.dependenciesRetargeted += 1;
    }

    for (const carrier of carriers) {
      if (carrier.id === selected.id) continue;
      for (const conditionId of carrier.resource.status.conditionIds ?? []) {
        removedConditionIds.add(conditionId);
      }
      if (!tree.receipts?.[carrier.id]) {
        tree.receipts = {
          ...(tree.receipts ?? {}),
          [carrier.id]: receiptFor(tree, carrier, canonicalId, now),
        };
        stats.receiptsCreated += 1;
      }
      delete tree.resources?.[carrier.id];
      delete tree.taskTriggers?.[carrier.id];
      for (const [attemptId, attempt] of Object.entries(tree.attempts ?? {})) {
        if (attempt.taskId !== carrier.id) continue;
        delete tree.attempts?.[attemptId];
        stats.attemptsRemoved += 1;
      }
      stats.resourcesAbsorbed += 1;
    }

    if (selected.id !== canonicalId) {
      if (!tree.receipts?.[selected.id]) {
        tree.receipts = {
          ...(tree.receipts ?? {}),
          [selected.id]: receiptFor(tree, selected, canonicalId, now),
        };
        stats.receiptsCreated += 1;
      }
      selected.resource.metadata.id = canonicalId;
      selected.resource.metadata.resourceVersion += 1;
      tree.resources![canonicalId] = selected.resource;
      delete tree.resources![selected.id];
      if (tree.taskTriggers?.[selected.id]) {
        tree.taskTriggers[canonicalId] = retargetTrigger(
          tree.taskTriggers[selected.id]!,
          selected.id,
          canonicalId,
        );
        delete tree.taskTriggers[selected.id];
      }
      for (const attempt of Object.values(tree.attempts ?? {})) {
        if (attempt.taskId === selected.id) attempt.taskId = canonicalId;
      }
      stats.resourcesRenamed += 1;
    }
    stats.specsConsolidated += 1;
  }

  const usedConditionIds = new Set(
    Object.values(tree.resources ?? {}).flatMap(
      (resource) => resource.status.conditionIds ?? [],
    ),
  );
  for (const conditionId of removedConditionIds) {
    if (usedConditionIds.has(conditionId)) continue;
    if (!tree.conditions?.[conditionId]) continue;
    delete tree.conditions?.[conditionId];
    stats.conditionsRemoved += 1;
  }
  tree.active_task_ids = [
    ...new Set(
      (tree.active_task_ids ?? []).map((id) => canonicalByOldId.get(id) ?? id),
    ),
  ];
  if (tree.active_task_id && !tree.resources?.[tree.active_task_id]) {
    tree.active_task_id = null;
  }
  return stats;
}

function argumentValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function migrationConfig(): TaskStateConfig {
  const appDir = resolve(import.meta.dirname, "..");
  const paths = projectRuntimePaths(appDir);
  return {
    appDir,
    projectDir: resolve(appDir, "../aks-rp-e2e"),
    statePath: paths.taskStatePath,
    journalPath: paths.journalPath,
    worker: "master-validation-failure-carrier-migration",
    maxConcurrent: 8,
  };
}

if (import.meta.main) {
  const config = migrationConfig();
  const pause = process.argv.includes("--pause");
  const resume = process.argv.includes("--resume");
  const apply = process.argv.includes("--apply");
  if ([pause, resume, apply].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --pause, --resume, or --apply");
  }
  if (pause || resume) {
    const lifecycle = pause ? "paused" : "active";
    setProjectLifecycle(
      config,
      lifecycle,
      `master-validation failure carrier migration ${pause ? "pause" : "resume"}`,
    );
    console.log(JSON.stringify({ lifecycle }, null, 2));
    process.exit(0);
  }

  const expectedRevision = argumentValue("--expected-revision");
  if (apply && !expectedRevision) {
    throw new Error("--apply requires --expected-revision=<dry-run revision>");
  }
  const currentRevision = createHash("sha256")
    .update(readFileSync(config.statePath))
    .digest("hex");
  let stats: FailureCarrierMigrationStats | undefined;
  const result = migrateTaskState(config, {
    expectedRevision: expectedRevision ?? currentRevision,
    dryRun: !apply,
    allowShrinkage: true,
    migrate: (tree) => {
      stats = migrateMasterValidationFailureCarriers(tree);
    },
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        ...result,
        stats,
        disposition:
          "Each spec keeps its newest live carrier and exact wait. Superseded fingerprint identities become receipts; the journal and pipeline artifacts remain detailed episode history.",
      },
      null,
      2,
    ),
  );
}
