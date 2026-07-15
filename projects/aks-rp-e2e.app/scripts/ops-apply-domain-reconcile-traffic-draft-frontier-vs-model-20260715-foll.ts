import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type MutableRecord = Record<string, unknown>;

type ArchivedTask = MutableRecord & {
  id: string;
  parent_id?: string;
  state?: string;
  status?: string;
  owner?: string;
  goal?: string;
  inputs?: string[];
  outputs?: string[];
  acceptance?: string[];
  conflict_scope?: string[];
  context?: MutableRecord;
  trace?: MutableRecord;
};

type ArchivedBundle = {
  version?: number;
  generated_at?: string;
  reason?: string;
  parent_id?: string;
  summary?: string;
  archived?: number;
  tasks?: ArchivedTask[];
};

const attemptId =
  "a_ops-apply-domain-reconcile-traffic-draft-frontier-vs-model-20260715-foll_20260715012642";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const targetTaskId = "domain/verify-traffic-alb-ready-datapath-pair-20260715";
const expectedParentId = "aks-feature-compact-loop";
const expectedConflictScope = ["feature-compact:traffic"] as const;
const expectedOutput =
  "evidence/archive/verify-traffic-alb-ready-datapath-pair-20260715.md";
const expectedInputs = [
  "evidence/archive/domain-reconcile-traffic-draft-frontier-vs-model-20260715.md",
  "features/traffic-alb-controller/compact/staging.summary.md",
  "features/traffic-alb-controller/compact/staging.plan.json",
] as const;
const evidencePath =
  "evidence/archive/ops-apply-domain-reconcile-traffic-draft-frontier-vs-model-20260715-foll.md";

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function writeTextFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNarrowAlbScope(task: ArchivedTask): void {
  const goal = typeof task.goal === "string" ? task.goal : "";
  const acceptance = asStringArray(task.acceptance).join("\n");
  const joined = `${goal}\n${acceptance}`;
  if (!joined.includes("spec.traffic-alb-controller.ingress-routing")) {
    throw new Error("Task no longer references ingress-routing narrow scope");
  }
  if (!joined.includes("spec.traffic-alb-controller.upgrade-survival")) {
    throw new Error("Task no longer references upgrade-survival narrow scope");
  }
  if (!joined.includes("spec.traffic-alb-controller.enable-lifecycle")) {
    throw new Error(
      "Task no longer documents enable-lifecycle quarantine/non-reopen guard",
    );
  }
  if (
    !/without reopening|do not widen back|remains quarantined/i.test(joined)
  ) {
    throw new Error(
      "Task no longer expresses the narrow no-reopen/no-widen ALB scope",
    );
  }
}

function latestArchivePathForTask(taskId: string): string {
  const archiveDir = resolve(appDir, ".state/tasks/archive");
  const files = readdirSync(archiveDir)
    .filter((file) => /^done-leaves-.*\.json$/.test(file))
    .sort()
    .reverse();

  for (const file of files) {
    const absolute = resolve(archiveDir, file);
    const bundle = JSON.parse(readFileSync(absolute, "utf-8")) as ArchivedBundle;
    const found = (bundle.tasks ?? []).find((task) => task.id === taskId);
    if (found) return absolute;
  }

  throw new Error(`No archived done-leaves bundle contains ${taskId}`);
}

const archivePath = latestArchivePathForTask(targetTaskId);
const beforeBundle = JSON.parse(readFileSync(archivePath, "utf-8")) as ArchivedBundle;
const beforeTask = (beforeBundle.tasks ?? []).find(
  (task) => task.id === targetTaskId,
);
assert(beforeTask, `Missing archived task ${targetTaskId} in ${archivePath}`);
assert(
  beforeTask.parent_id === expectedParentId,
  `Expected ${targetTaskId}.parent_id=${expectedParentId}; found ${beforeTask.parent_id ?? "(missing)"}`,
);
assert(
  JSON.stringify(asStringArray(beforeTask.conflict_scope)) ===
    JSON.stringify([...expectedConflictScope]),
  `Expected ${targetTaskId}.conflict_scope=${JSON.stringify(expectedConflictScope)}; found ${JSON.stringify(asStringArray(beforeTask.conflict_scope))}`,
);
assert(
  JSON.stringify(asStringArray(beforeTask.outputs)) ===
    JSON.stringify([expectedOutput]),
  `Expected ${targetTaskId}.outputs=${JSON.stringify([expectedOutput])}; found ${JSON.stringify(asStringArray(beforeTask.outputs))}`,
);
assertNarrowAlbScope(beforeTask);

const beforeSnapshot = {
  archivePath: archivePath.replace(`${appDir}/`, ""),
  id: beforeTask.id,
  parent_id: beforeTask.parent_id,
  state: beforeTask.state ?? beforeTask.status ?? null,
  owner: beforeTask.owner ?? null,
  inputs: [...asStringArray(beforeTask.inputs)],
  outputs: [...asStringArray(beforeTask.outputs)],
  conflict_scope: [...asStringArray(beforeTask.conflict_scope)],
  goal: beforeTask.goal,
  acceptance: [...asStringArray(beforeTask.acceptance)],
};

const updatedBundle: ArchivedBundle = {
  ...beforeBundle,
  tasks: (beforeBundle.tasks ?? []).map((task) => {
    if (task.id !== targetTaskId) return task;
    return {
      ...task,
      inputs: [...expectedInputs],
      trace: {
        ...asRecord(task.trace),
        metadata_drift_repaired_at: appliedAt,
        metadata_drift_repaired_by: worker,
        metadata_drift_repair_attempt_id: attemptId,
        metadata_drift_restored_inputs_count: expectedInputs.length,
        metadata_drift_repaired_archive_path: archivePath.replace(`${appDir}/`, ""),
      },
      context: {
        ...asRecord(task.context),
        metadataRepair: {
          appliedAt,
          appliedBy: worker,
          attemptId,
          restoredInputs: [...expectedInputs],
          reason:
            "Reviewed follow-up found the ALB ready-pair successor existed with correct parent/conflict/output/scope but an empty inputs array; this repair restores the three required source refs without widening scope.",
        },
      },
    } satisfies ArchivedTask;
  }),
};

writeFileSync(archivePath, `${JSON.stringify(updatedBundle, null, 2)}\n`, "utf-8");

const afterBundle = JSON.parse(readFileSync(archivePath, "utf-8")) as ArchivedBundle;
const afterTask = (afterBundle.tasks ?? []).find((task) => task.id === targetTaskId);
assert(afterTask, `Missing archived task ${targetTaskId} after write in ${archivePath}`);
assertNarrowAlbScope(afterTask);
assert(
  JSON.stringify(stableUnique(asStringArray(afterTask.inputs))) ===
    JSON.stringify(stableUnique([...expectedInputs])),
  `Expected exact restored inputs; found ${JSON.stringify(afterTask.inputs ?? [], null, 2)}`,
);
assert(
  afterTask.parent_id === expectedParentId,
  `Parent drifted during repair: expected ${expectedParentId}; found ${afterTask.parent_id ?? "(missing)"}`,
);
assert(
  JSON.stringify(asStringArray(afterTask.conflict_scope)) ===
    JSON.stringify([...expectedConflictScope]),
  `Conflict scope drifted during repair: expected ${JSON.stringify(expectedConflictScope)}; found ${JSON.stringify(asStringArray(afterTask.conflict_scope))}`,
);
assert(
  JSON.stringify(asStringArray(afterTask.outputs)) ===
    JSON.stringify([expectedOutput]),
  `Output drifted during repair: expected ${JSON.stringify([expectedOutput])}; found ${JSON.stringify(asStringArray(afterTask.outputs))}`,
);

const afterSnapshot = {
  archivePath: archivePath.replace(`${appDir}/`, ""),
  id: afterTask.id,
  parent_id: afterTask.parent_id,
  state: afterTask.state ?? afterTask.status ?? null,
  owner: afterTask.owner ?? null,
  inputs: [...asStringArray(afterTask.inputs)],
  outputs: [...asStringArray(afterTask.outputs)],
  conflict_scope: [...asStringArray(afterTask.conflict_scope)],
  goal: afterTask.goal,
  acceptance: [...asStringArray(afterTask.acceptance)],
  trace: asRecord(afterTask.trace),
  context: asRecord(afterTask.context),
};

const evidenceBody = `# ALB ready-pair metadata repair

- Attempt: ${attemptId}
- Applied at: ${appliedAt}
- Target task: ${targetTaskId}
- Repaired archive bundle: ${archivePath.replace(`${appDir}/`, "")}
- Supported mechanism: app-local archive repair script that updates the archived done-leaf record and records the exact change; no direct hand editing

## Repair summary

Restored the three required inputs on the archived ALB ready-pair leaf and verified that parent, conflict scope, output, and narrow two-spec scope were preserved exactly.

The task was already completed and archived before this repair; the repair only fixed missing task metadata so supported reads like \`bun run task-tree show ${targetTaskId}\` surface the intended source refs.

## Before

\`\`\`json
${JSON.stringify(beforeSnapshot, null, 2)}
\`\`\`

## After

\`\`\`json
${JSON.stringify(afterSnapshot, null, 2)}
\`\`\`

## Exact restored inputs

${expectedInputs.map((input) => `- ${input}`).join("\n")}

## Preserved invariants

- Parent remains \`${expectedParentId}\`
- Conflict scope remains \`${expectedConflictScope[0]}\`
- Output remains \`${expectedOutput}\`
- Scope remains limited to \`spec.traffic-alb-controller.ingress-routing\` plus \`spec.traffic-alb-controller.upgrade-survival\`
- \`spec.traffic-alb-controller.enable-lifecycle\` stays quarantine-only and is not reopened by this metadata repair
`;

writeTextFile(resolve(appDir, evidencePath), evidenceBody);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      archivePath: archivePath.replace(`${appDir}/`, ""),
      evidencePath,
      targetTaskId,
      beforeSnapshot,
      afterSnapshot,
    },
    null,
    2,
  ),
);
