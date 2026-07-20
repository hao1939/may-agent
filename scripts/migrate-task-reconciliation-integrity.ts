import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  projectRuntimePaths,
  readTaskState,
  saveTaskState,
  type TaskTree,
  type TaskStateConfig,
} from "@may-agent/sdk";

type JsonObject = Record<string, any>;

type AppConfig = {
  id: string;
  appDir: string;
  projectDir: string;
  owner: string;
};

const workspace = resolve(import.meta.dir, "..");
const apps: AppConfig[] = [
  {
    id: "may-agent",
    appDir: "projects/may-agent.app",
    projectDir: "projects/may-agent",
    owner: "tech-lead",
  },
  {
    id: "aks-rp-e2e",
    appDir: "projects/aks-rp-e2e.app",
    projectDir: "projects/aks-rp-e2e",
    owner: "aks-explorer",
  },
  {
    id: "evaluation",
    appDir: "projects/evaluation.app",
    projectDir: "projects/evaluation.app",
    owner: "evaluator",
  },
  {
    id: "gym",
    appDir: "projects/gym.app",
    projectDir: "projects/gym",
    owner: "gym",
  },
  {
    id: "scout-knowledge-lib",
    appDir: "projects/scout-knowledge-lib.app",
    projectDir: "projects/scout-knowledge-lib",
    owner: "scout",
  },
].map((app) => ({
  ...app,
  appDir: join(workspace, app.appDir),
  projectDir: join(workspace, app.projectDir),
}));

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stable(entry)]),
  );
}

function taskHash(spec: JsonObject, effectiveOwner: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        stable({
          outcome: spec.outcome,
          acceptance: spec.acceptance,
          mode: spec.mode,
          owner: effectiveOwner,
          workflow: spec.workflow ?? null,
          input: spec.input ?? {},
          outputs: spec.outputs ?? [],
          dependsOn: spec.dependsOn ?? [],
        }),
      ),
    )
    .digest("hex");
}

function resolvedOwner(
  state: JsonObject,
  taskId: string,
  appOwner: string,
  overrideSpec?: JsonObject,
): string {
  const first = overrideSpec ?? state.resources?.[taskId]?.spec;
  if (typeof first?.owner === "string" && first.owner.trim())
    return first.owner.trim();
  let parentId = first?.parentId;
  const seen = new Set<string>();
  while (typeof parentId === "string" && parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parentResource = state.resources?.[parentId];
    if (
      typeof parentResource?.spec?.owner === "string" &&
      parentResource.spec.owner.trim()
    ) {
      return parentResource.spec.owner.trim();
    }
    if (parentResource) {
      parentId = parentResource.spec.parentId;
      continue;
    }
    const group = state.groups?.[parentId];
    if (typeof group?.owner === "string" && group.owner.trim())
      return group.owner.trim();
    parentId = group?.parent_id;
  }
  return appOwner;
}

function updateSpec(
  state: JsonObject,
  taskId: string,
  appOwner: string,
  now: string,
  update: (spec: JsonObject) => void,
): boolean {
  const resource = state.resources?.[taskId];
  if (!resource) return false;
  const beforeSpec = structuredClone(resource.spec);
  const beforeOwner = resolvedOwner(state, taskId, appOwner, beforeSpec);
  const beforeHash = taskHash(beforeSpec, beforeOwner);
  const nextSpec = structuredClone(beforeSpec);
  update(nextSpec);
  if (JSON.stringify(stable(beforeSpec)) === JSON.stringify(stable(nextSpec)))
    return false;

  const nextOwner = resolvedOwner(state, taskId, appOwner, nextSpec);
  const executionChanged = beforeHash !== taskHash(nextSpec, nextOwner);
  resource.spec = nextSpec;
  resource.metadata.resourceVersion =
    Number(resource.metadata.resourceVersion ?? 0) + 1;
  if (executionChanged) {
    resource.metadata.generation =
      Number(resource.metadata.generation ?? 0) + 1;
    resource.status.observedGeneration = Math.min(
      Number(resource.status.observedGeneration ?? 0),
      resource.metadata.generation - 1,
    );
    resource.status.phase = "pending";
    delete resource.status.currentAttemptId;
    resource.status.conditionIds = [];
  }
  resource.status.updatedAt = now;
  return true;
}

function minimalGroups(seed: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(seed.groups ?? {}).map(([id, raw]) => {
      const group = raw as JsonObject;
      return [
        id,
        {
          id,
          parent_id: group.parent_id ?? null,
          ...(typeof group.owner === "string" && group.owner
            ? { owner: group.owner }
            : {}),
          ...(typeof group.kind === "string" && group.kind
            ? { kind: group.kind }
            : {}),
        },
      ];
    }),
  );
}

function failureFingerprints(state: JsonObject, taskId: string): string[] {
  return [
    ...new Set(
      Object.values(state.attempts ?? {})
        .filter(
          (attempt: any) => attempt.taskId === taskId && attempt.failureReason,
        )
        .map((attempt: any) => String(attempt.failureReason)),
    ),
  ];
}

function absorbTask(
  state: JsonObject,
  taskId: string,
  appOwner: string,
  now: string,
  summary: string,
  evidence: string[],
): boolean {
  const resource = state.resources?.[taskId];
  if (!resource) return false;
  const owner = resolvedOwner(state, taskId, appOwner);
  state.receipts ??= {};
  state.receipts[taskId] = {
    metadata: {
      id: taskId,
      generation: resource.metadata.generation,
      resourceVersion: 1,
    },
    specHash: taskHash(resource.spec, owner),
    parentId: resource.spec.parentId,
    outcome: resource.spec.outcome,
    acceptance: [...(resource.spec.acceptance ?? [])],
    owner,
    ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
    handler: `owner:${owner}`,
    summary,
    evidence,
    acceptanceBasis: { method: "owner-judgment", evidence },
    failureFingerprints: failureFingerprints(state, taskId),
    completedAt: now,
  };
  delete state.resources[taskId];
  delete state.taskTriggers?.[taskId];
  return true;
}

function migrateReceipts(state: JsonObject): number {
  let changed = 0;
  for (const receipt of Object.values(state.receipts ?? {}) as JsonObject[]) {
    if (receipt.acceptanceBasis && !("verification" in receipt)) continue;
    const previous = receipt.acceptanceBasis ?? receipt.verification;
    receipt.acceptanceBasis =
      previous && typeof previous === "object"
        ? previous
        : {
            method: String(receipt.handler ?? "").startsWith("workflow:")
              ? "workflow-contract"
              : "owner-judgment",
            evidence: [...(receipt.evidence ?? [])],
          };
    if ("verification" in receipt) delete receipt.verification;
    receipt.metadata.resourceVersion =
      Number(receipt.metadata.resourceVersion ?? 0) + 1;
    changed += 1;
  }
  return changed;
}

function interruptRunningAttempts(state: JsonObject, now: string): number {
  let interrupted = 0;
  for (const attempt of Object.values(
    state.attempts ?? {},
  ) as JsonObject[]) {
    if (attempt.state !== "running") continue;

    attempt.state = "interrupted";
    attempt.finishedAt = now;
    attempt.failureReason = "task-integrity-cutover";
    attempt.summary = "Interrupted by canonical task-state deployment";
    if (attempt.metadata) {
      attempt.metadata.resourceVersion =
        Number(attempt.metadata.resourceVersion ?? 0) + 1;
    }

    const resource = state.resources?.[attempt.taskId];
    if (resource?.status?.currentAttemptId === attempt.metadata?.id) {
      resource.status.phase = "pending";
      resource.status.observedGeneration = Math.max(
        0,
        Number(resource.metadata?.generation ?? 0) - 1,
      );
      delete resource.status.currentAttemptId;
      resource.status.updatedAt = now;
      resource.metadata.resourceVersion =
        Number(resource.metadata.resourceVersion ?? 0) + 1;
    }
    interrupted += 1;
  }
  return interrupted;
}

function nearestLiveParent(
  state: JsonObject,
  parentId: string,
): { parentId: string; owner?: string } | null {
  let cursor: string | undefined = parentId;
  let inheritedOwner: string | undefined;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    if (state.resources?.[cursor] || state.groups?.[cursor])
      return { parentId: cursor, owner: inheritedOwner };
    const receipt = state.receipts?.[cursor];
    if (!receipt) return null;
    inheritedOwner ??=
      typeof receipt.owner === "string" ? receipt.owner : undefined;
    cursor = receipt.parentId;
  }
  return null;
}

function repairParents(
  state: JsonObject,
  appOwner: string,
  now: string,
): number {
  let changed = 0;
  for (const [taskId, resource] of Object.entries(
    state.resources ?? {},
  ) as Array<[string, JsonObject]>) {
    const parentId = String(resource.spec.parentId ?? "");
    if (state.resources?.[parentId] || state.groups?.[parentId]) continue;
    const replacement = nearestLiveParent(state, parentId);
    if (!replacement)
      throw new Error(`${taskId} has no live ancestor for parent ${parentId}`);
    if (
      updateSpec(state, taskId, appOwner, now, (spec) => {
        spec.parentId = replacement.parentId;
        if (!spec.owner && replacement.owner) spec.owner = replacement.owner;
      })
    ) {
      changed += 1;
    }
  }
  return changed;
}

function normalizeGymInput(state: JsonObject, now: string): number {
  let changed = 0;
  for (const [taskId, resource] of Object.entries(
    state.resources ?? {},
  ) as Array<[string, JsonObject]>) {
    if (taskId.startsWith("runtime/review-proposal/")) {
      const old = resource.spec.input ?? {};
      const input = Object.fromEntries(
        [
          "failurePath",
          "incidentId",
          "incidentPath",
          "outcomePath",
          "requestKey",
          "runDir",
          "runId",
        ]
          .filter((key) => old[key] !== undefined)
          .map((key) => [key, old[key]]),
      );
      input.kind = String(old.kind ?? "unknown");
      if (updateSpec(state, taskId, "gym", now, (spec) => (spec.input = input)))
        changed += 1;
    } else if (taskId.startsWith("runtime/incident-intake/")) {
      const old = resource.spec.input ?? {};
      const evaluation =
        old.evaluation && typeof old.evaluation === "object"
          ? old.evaluation
          : old;
      const input: JsonObject = { kind: "incident" };
      for (const key of ["incidentId", "sessionId", "reason"]) {
        if (old[key] !== undefined) input[key] = old[key];
      }
      for (const key of [
        "agent",
        "artifactFound",
        "artifactPath",
        "lane",
        "reviewedVerdict",
        "reviewSessionId",
        "sessionId",
        "verdict",
      ]) {
        if (evaluation[key] !== undefined) input[key] = evaluation[key];
      }
      if (updateSpec(state, taskId, "gym", now, (spec) => (spec.input = input)))
        changed += 1;
    }
  }
  return changed;
}

function normalizeAksInputs(state: JsonObject, now: string): number {
  let changed = 0;
  for (const [taskId, resource] of Object.entries(
    state.resources ?? {},
  ) as Array<[string, JsonObject]>) {
    const old = resource.spec.input;
    if (!old || typeof old !== "object") continue;
    let allowed: string[] | null = null;
    if (taskId.startsWith("spec/verify-"))
      allowed = ["specId", "loopTaskId", "statePath"];
    if (taskId.startsWith("compact/")) {
      allowed = [
        "featureKey",
        "capabilityId",
        "loopTaskId",
        "statePath",
        "packetPath",
      ];
    }
    if (!allowed) continue;
    const input = Object.fromEntries(
      allowed
        .filter((key) => old[key] !== undefined)
        .map((key) => [key, old[key]]),
    );
    if (
      updateSpec(
        state,
        taskId,
        "aks-explorer",
        now,
        (spec) => (spec.input = input),
      )
    )
      changed += 1;
  }
  return changed;
}

function normalizeScout(
  state: JsonObject,
  app: AppConfig,
  now: string,
): { changed: number; retired: number } {
  let changed = 0;
  let retired = 0;
  const sources = ["arxiv", "hn", "xhs", "github"];
  for (const source of sources) {
    const id = `explore-${source}`;
    if (
      updateSpec(state, id, app.owner, now, (spec) => {
        spec.parentId = "ongoing-research";
        spec.input = { source };
        spec.outputs = [
          join(app.projectDir, "knowledge"),
          join(app.appDir, "agents/scout/workspace/digest/today.md"),
        ];
      })
    ) {
      changed += 1;
    }
  }
  if (
    updateSpec(state, "daily-digest", app.owner, now, (spec) => {
      delete spec.input;
      spec.outputs = [join(app.appDir, "agents/scout/workspace/digest")];
    })
  ) {
    changed += 1;
  }
  if (
    updateSpec(state, "library-maintenance", app.owner, now, (spec) => {
      spec.parentId = "library-operations";
      spec.outputs = [
        join(app.projectDir, "knowledge"),
        join(app.projectDir, "reports"),
      ];
    })
  ) {
    changed += 1;
  }
  if (
    updateSpec(
      state,
      "runtime/library-health-observer",
      app.owner,
      now,
      (spec) => {
        spec.parentId = "library-operations";
        delete spec.input;
        spec.outputs = [
          join(app.appDir, ".state/library-health-packets.jsonl"),
        ];
      },
    )
  ) {
    changed += 1;
  }

  for (const [legacyId, standingId] of [
    ["explore-github-evt-3593695", "explore-github"],
    ["explore-arxiv-3591858", "explore-arxiv"],
    ["explore-github-3598531", "explore-github"],
  ]) {
    const standing = state.resources?.[standingId];
    const evidence = [
      `absorbed-by:${standingId}`,
      ...(standing?.status?.evidence ?? []),
      ...(standing?.status?.summary
        ? [`standing-summary:${standing.status.summary}`]
        : []),
    ];
    if (
      absorbTask(
        state,
        legacyId,
        app.owner,
        now,
        `Legacy source carrier was absorbed by standing task ${standingId}.`,
        evidence,
      )
    ) {
      retired += 1;
    }
  }

  if (state.resources?.["xhs-cookie-refresh-blocked"]) {
    delete state.resources["xhs-cookie-refresh-blocked"];
    delete state.taskTriggers?.["xhs-cookie-refresh-blocked"];
    retired += 1;
  }
  delete state.conditions?.["task-done:xhs-cookie-refresh-blocked"];
  const xhs = state.resources?.["explore-xhs"];
  if (xhs) {
    const id = "credential-ready:xhs";
    state.conditions ??= {};
    state.conditions[id] = {
      metadata: { id, generation: 1, resourceVersion: 1 },
      spec: {
        type: "credential.ready",
        subject: "credential:xhs",
        expected: { field: "state", equals: "ready" },
      },
      status: {
        observedGeneration: 0,
        state: "unknown",
        observedAt: now,
      },
    };
    xhs.status.phase = "waiting";
    xhs.status.observedGeneration = xhs.metadata.generation;
    xhs.status.conditionIds = [id];
    xhs.status.summary =
      "Waiting for the XHS browser credential to become ready.";
    xhs.status.evidence = [
      "migration:legacy-human-holder-replaced-by-exact-credential-condition",
    ];
    xhs.status.updatedAt = now;
  }
  return { changed, retired };
}

function pruneConditions(state: JsonObject): void {
  const linked = new Set<string>();
  for (const resource of Object.values(state.resources ?? {}) as JsonObject[]) {
    for (const id of resource.status?.conditionIds ?? [])
      linked.add(String(id));
  }
  for (const id of Object.keys(state.conditions ?? {})) {
    if (!linked.has(id)) delete state.conditions[id];
  }
}

function removeEmptyInputsAndProjectionOutputs(
  state: JsonObject,
  appOwner: string,
  now: string,
): number {
  let changed = 0;
  for (const [taskId, resource] of Object.entries(
    state.resources ?? {},
  ) as Array<[string, JsonObject]>) {
    if (
      updateSpec(state, taskId, appOwner, now, (spec) => {
        if (
          spec.input &&
          typeof spec.input === "object" &&
          Object.keys(spec.input).length === 0
        )
          delete spec.input;
        if (Array.isArray(spec.outputs)) {
          spec.outputs = spec.outputs.filter((path: unknown) =>
            typeof path === "string"
              ? !path.includes(".state/tasks/tree.json")
              : true,
          );
        }
      })
    ) {
      changed += 1;
    }
  }
  return changed;
}

function validate(state: JsonObject, app: AppConfig): void {
  if (state.project_lifecycle !== "paused")
    throw new Error(`${app.id} must remain paused during migration`);
  const running = Object.values(state.attempts ?? {}).filter(
    (attempt: any) => attempt.state === "running",
  );
  if (running.length)
    throw new Error(`${app.id} still has ${running.length} running attempt(s)`);
  if (
    "tasks" in state ||
    "active_task_id" in state ||
    "active_task_ids" in state
  ) {
    throw new Error(
      `${app.id} retains generated projection fields in canonical state`,
    );
  }
  for (const [id, receipt] of Object.entries(state.receipts ?? {}) as Array<
    [string, JsonObject]
  >) {
    if (!receipt.acceptanceBasis || receipt.verification)
      throw new Error(`${app.id}/${id} lacks canonical acceptanceBasis`);
  }
  for (const [id, resource] of Object.entries(state.resources ?? {}) as Array<
    [string, JsonObject]
  >) {
    const parentId = String(resource.spec?.parentId ?? "");
    if (!state.resources?.[parentId] && !state.groups?.[parentId]) {
      throw new Error(`${app.id}/${id} has invalid live parent ${parentId}`);
    }
    if (
      resource.spec?.owner === "human" ||
      String(resource.spec?.owner ?? "").startsWith("human:")
    ) {
      throw new Error(`${app.id}/${id} retains a non-runnable human owner`);
    }
    const banned = new Set(["eventId", "timestamp", "trace", "params"]);
    for (const key of Object.keys(resource.spec?.input ?? {})) {
      if (banned.has(key))
        throw new Error(
          `${app.id}/${id} retains observation field input.${key}`,
        );
    }
    const seen = new Set<string>([id]);
    let cursor: string | undefined = parentId;
    while (cursor && state.resources?.[cursor]) {
      if (seen.has(cursor))
        throw new Error(`${app.id}/${id} has a containment cycle at ${cursor}`);
      seen.add(cursor);
      cursor = state.resources[cursor].spec.parentId;
    }
  }
}

function migrate(
  app: AppConfig,
  now: string,
): { state: JsonObject; summary: JsonObject } {
  const paths = projectRuntimePaths(app.appDir);
  const state = structuredClone(readJson(paths.taskStatePath));
  const seed = readJson(join(app.appDir, "tasks/seed.json"));
  if (state.project_lifecycle !== "paused")
    throw new Error(`${app.id} is not paused`);
  state.groups = minimalGroups(seed);
  delete state.tasks;
  delete state.active_task_id;
  delete state.active_task_ids;

  const attempts = interruptRunningAttempts(state, now);
  const receipts = migrateReceipts(state);
  let specs = 0;
  let retired = 0;
  if (app.id === "may-agent") {
    for (const id of [
      "runtime/platform-owner-review",
      "runtime/daily-ops-digest",
    ]) {
      if (updateSpec(state, id, app.owner, now, (spec) => delete spec.input))
        specs += 1;
    }
  }
  if (app.id === "aks-rp-e2e") specs += normalizeAksInputs(state, now);
  if (app.id === "gym") specs += normalizeGymInput(state, now);
  if (app.id === "scout-knowledge-lib") {
    const scout = normalizeScout(state, app, now);
    specs += scout.changed;
    retired += scout.retired;
  }
  if (app.id === "evaluation") {
    if (
      absorbTask(
        state,
        "runtime/pipeline-monitor",
        app.owner,
        now,
        "Legacy pipeline-monitor task was absorbed by the app-owned evaluation pipeline watcher.",
        ["watcher:watchers/evaluation-pipeline.ts"],
      )
    ) {
      retired += 1;
    }
  }

  specs += removeEmptyInputsAndProjectionOutputs(state, app.owner, now);
  const parents = repairParents(state, app.owner, now);
  pruneConditions(state);
  state.updated_at = now;
  validate(state, app);
  return {
    state,
    summary: {
      app: app.id,
      resources: Object.keys(state.resources ?? {}).length,
      receipts: Object.keys(state.receipts ?? {}).length,
      conditions: Object.keys(state.conditions ?? {}).length,
      attemptsInterrupted: attempts,
      receiptsMigrated: receipts,
      specsNormalized: specs,
      parentsRepaired: parents,
      carriersRetired: retired,
    },
  };
}

function snapshot(app: AppConfig, stamp: string): string {
  const destination = join(
    app.appDir,
    ".state/migrations",
    `task-integrity-cutover-${stamp}`,
  );
  mkdirSync(destination, { recursive: true });
  for (const [name, source] of [
    ["state.json", projectRuntimePaths(app.appDir).taskStatePath],
    ["tree.json", projectRuntimePaths(app.appDir).taskTreePath],
    ["seed.json", join(app.appDir, "tasks/seed.json")],
  ]) {
    if (existsSync(source)) copyFileSync(source, join(destination, name));
  }
  return destination;
}

const apply = process.argv.includes("--apply");
const now = new Date().toISOString();
const stamp = now.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const results = apps.map((app) => ({ app, ...migrate(app, now) }));

if (apply) {
  for (const result of results) {
    const backup = snapshot(result.app, stamp);
    const paths = projectRuntimePaths(result.app.appDir);
    writeFileSync(
      paths.taskStatePath,
      `${JSON.stringify(result.state, null, 2)}\n`,
      "utf8",
    );
    const config: TaskStateConfig = {
      appDir: result.app.appDir,
      projectDir: result.app.projectDir,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "task-integrity-cutover",
      maxConcurrent: 1,
    };
    const normalized = readTaskState(config);
    saveTaskState(config, normalized, { allowShrinkage: true });
    const logPath = paths.migrationLogPath;
    mkdirSync(dirname(logPath), { recursive: true });
    const existing = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
    writeFileSync(
      logPath,
      `${existing}${JSON.stringify({ ts: now, kind: "task_reconciliation_integrity_cutover", backup, ...result.summary })}\n`,
      "utf8",
    );
  }
}

for (const result of results) {
  console.log(
    JSON.stringify({ mode: apply ? "applied" : "check", ...result.summary }),
  );
}
