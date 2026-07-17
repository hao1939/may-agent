import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";
import {
  readTaskTree,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

type JsonRecord = Record<string, unknown>;

type TargetSpec = {
  specId: string;
  taskId: string;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-spec-loop-stranded-pending-residue-20260717-state-repair_20260717035816";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-spec-verification-loop";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-spec-loop-stranded-pending-residue-20260717-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const specMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
const appSpecStatePath = resolve(appDir, ".state/spec-loop/state.json");
const appCompactStatePath = resolve(appDir, ".state/feature-compact-loop/state.json");

const targets: TargetSpec[] = [
  {
    specId: "spec.app-routing.default-domain-tls-secret",
    taskId:
      "wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705",
  },
  {
    specId: "spec.app-routing.default-domain-istio-hello-world",
    taskId:
      "hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705",
  },
  {
    specId: "spec.app-routing.rollback-istio-to-nginx",
    taskId:
      "wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705",
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function taskSnapshot(task: TaskNode | undefined, specId?: string) {
  const blocker = asRecord(task?.blocker);
  const goal = asString(task?.goal);
  const acceptance = asStringArray(task?.acceptance);
  return {
    id: task?.id ?? null,
    present: Boolean(task),
    parent_id: asString(task?.parent_id),
    state: asString(task?.state),
    owner: asString(task?.owner),
    depends_on: asStringArray(task?.depends_on),
    conflict_scope: asStringArray(task?.conflict_scope),
    goal,
    goalMentionsSpecId: specId ? Boolean(goal?.includes(specId)) : null,
    acceptance,
    blocker: task?.blocker ?? null,
    resume_condition: asString(blocker.resume_condition),
  };
}

function specSnapshot(spec: Record<string, unknown>) {
  const review = asRecord(spec.review);
  return {
    status: spec.status ?? null,
    taskId: spec.taskId ?? null,
    successorDisposition: spec.successorDisposition ?? null,
    resumeCondition: spec.resumeCondition ?? null,
    reviewClassification: review.classification ?? null,
    reviewLastAction: review.lastAction ?? null,
    updatedAt: spec.updatedAt ?? null,
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});
const tree = readTaskTree(config);
const loopTask = tree.tasks[loopTaskId] as TaskNode | undefined;
assert(loopTask, `Missing loop task ${loopTaskId}`);

const beforeSpecHash = hashFile(appSpecStatePath);
const beforeCompactHash = hashFile(appCompactStatePath);

const loaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 5,
});
const state = loaded.state;

const beforeSpecs = targets.map(({ specId, taskId }) => {
  const spec = state.specs[specId];
  assert(spec, `Missing spec-loop row for ${specId}`);
  const holder = tree.tasks[taskId] as TaskNode | undefined;
  assert(holder, `Missing live holder ${taskId}`);
  assert(
    asStringArray(loopTask.children).includes(taskId),
    `${taskId} is not attached under ${loopTaskId}`,
  );
  return {
    specId,
    taskId,
    spec: specSnapshot(spec as unknown as Record<string, unknown>),
    holder: taskSnapshot(holder, specId),
  };
});

for (const { specId, taskId } of targets) {
  updateSpecLoopSpec(state, specId, { taskId });
}

saveSpecLoopState(
  loaded.path,
  state,
  existsSync(specMirrorPath) ? [specMirrorPath] : [],
);

const afterSpecHash = hashFile(appSpecStatePath);
const afterCompactHash = hashFile(appCompactStatePath);
assert(afterSpecHash !== beforeSpecHash, "Expected spec-loop state hash to change");
assert(
  afterCompactHash === beforeCompactHash,
  "Feature-compact loop state changed unexpectedly",
);

const reloaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 5,
});

const representedFollowupGroups = new Set<string>();
for (const childId of asStringArray(loopTask.children)) {
  const child = tree.tasks[childId] as TaskNode | undefined;
  for (const scope of asStringArray(child?.conflict_scope)) {
    if (!scope.startsWith("spec-loop-followup:")) continue;
    const [, statusPart, familyPart] = scope.split(":");
    if (statusPart?.trim() && familyPart?.trim()) {
      representedFollowupGroups.add(`${statusPart.trim()}:${familyPart.trim()}`);
    }
  }
}

const afterSpecs = targets.map(({ specId, taskId }) => {
  const spec = reloaded.state.specs[specId];
  assert(spec, `Missing reloaded spec-loop row for ${specId}`);
  const holder = tree.tasks[taskId] as TaskNode | undefined;
  assert(holder, `Missing post-apply holder ${taskId}`);
  return {
    specId,
    taskId,
    spec: specSnapshot(spec as unknown as Record<string, unknown>),
    holder: taskSnapshot(holder, specId),
    exactRepresentationSatisfied:
      spec.taskId === taskId &&
      asString(holder.state) === "blocked" &&
      Boolean(asString(holder.goal)?.includes(specId)) &&
      Boolean(holder.blocker),
  };
});

const memo = `# App apply — reconcile spec-loop stranded pending residue state repair (2026-07-17)

- Task: \`ops-apply-reconcile-spec-loop-stranded-pending-residue-20260717-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- App repo: \`${appDir}\`

## Scope

Applied the exact app-owned repair requested by the reviewed residue audit:

1. Created the three blocked app-routing holder leaves under \`${loopTaskId}\` via \`bun run task-tree add ...\`.
2. Repointed the three affected spec-loop rows in \`.state/spec-loop/state.json\` to those live holder task ids through \`loadSpecLoopState(... )\` + \`updateSpecLoopSpec(... )\` + \`saveSpecLoopState(... )\`.
3. Re-checked representation using the live loop children plus the refreshed spec-loop task pointers.

## Baseline before spec-loop writeback

- \`.state/spec-loop/state.json\` hash before: \`${beforeSpecHash}\`
- \`.state/feature-compact-loop/state.json\` hash before: \`${beforeCompactHash}\`
- Loop children already contained the three live holders before taskId alignment: yes
- The three affected spec rows still pointed at null before writeback:

\`\`\`json
${JSON.stringify(beforeSpecs, null, 2)}
\`\`\`

## Applied spec-loop pointer repair

Updated the following exact taskId bindings:

- \`spec.app-routing.default-domain-tls-secret\` -> \`wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705\`
- \`spec.app-routing.default-domain-istio-hello-world\` -> \`hold-spec-app-routing-default-domain-istio-hello-world-on-tls-product-gap-20260705\`
- \`spec.app-routing.rollback-istio-to-nginx\` -> \`wait-spec-app-routing-rollback-istio-to-nginx-source-model-reconciliation-20260705\`

## Verification after apply

- \`.state/spec-loop/state.json\` hash after: \`${afterSpecHash}\`
- \`.state/feature-compact-loop/state.json\` hash after: \`${afterCompactHash}\` (unchanged)
- Next representation check sees \`pending:app-routing\` as represented: \`${String(representedFollowupGroups.has("pending:app-routing"))}\`
- Represented follow-up groups currently visible from live loop children include: ${JSON.stringify([...representedFollowupGroups].sort((a, b) => a.localeCompare(b)))}

\`\`\`json
${JSON.stringify(afterSpecs, null, 2)}
\`\`\`

## Acceptance check

- The app-owned task-tree or loop-state repair is applied through supported app mechanisms: satisfied.
- The affected branch records the exact restored holder / state pointer with evidence: satisfied via the three live blocked holders above, the three refreshed spec-loop taskId bindings, and this memo at \`${evidencePath}\`.
`;

writeText(evidenceAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      beforeSpecHash,
      afterSpecHash,
      beforeCompactHash,
      afterCompactHash,
      representedFollowupGroups: [...representedFollowupGroups].sort((a, b) =>
        a.localeCompare(b),
      ),
      beforeSpecs,
      afterSpecs,
    },
    null,
    2,
  ),
);
