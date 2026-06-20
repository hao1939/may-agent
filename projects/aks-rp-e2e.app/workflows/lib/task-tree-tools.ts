import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import {
  appendToolJournal,
  isLeaf,
  planningPacket as sdkPlanningPacket,
  normalizeStringArray,
  readTaskTree,
  saveTaskTreeWithKanbanSnapshot,
  withTreeLock,
  type TaskNode,
  type TaskPlanningPacket,
  type TaskTree,
  type TaskTreeConfig,
} from "@may-agent/sdk";

export {
  appendPlannerRun,
  appendToolJournal,
  assignRunnableBacklogTasks,
  assignTask,
  compactDoneLeaves,
  completeTask,
  confirmRunnableBacklogLeaves,
  createTask,
  drainTaskAssignments,
  kanbanTaskTreeState,
  listRunnableBacklogTaskIds,
  markTaskDone,
  peekTaskAssignments,
  readTask,
  rejectTaskReview,
  requeueStaleActiveTasks,
  rollupParent,
  updateTaskOutputs,
  updateTaskText,
  repairTaskTreeRollups,
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskKanbanColumn,
  taskTreeConfig,
  unblockTask,
  writeKanbanSnapshot,
} from "@may-agent/sdk";
export type {
  CreateTaskInput,
  RunnableBacklogAssignmentResult,
  TaskAssignment,
  TaskCompletionClaim,
  TaskKanbanColumn,
  TaskKanbanProjection,
  TaskKanbanSnapshot,
  TaskKanbanState,
  RejectTaskReviewInput,
  RollupParentInput,
  TaskPlanningPacket,
  TaskPlanningSnapshot,
  TaskTreeCompactResult,
  TaskTreeRepairResult,
  TaskTreeSummary,
  TaskTreeToolConfig,
  UnblockTaskInput,
  UpdateTaskOutputsInput,
  UpdateTaskTextInput,
} from "@may-agent/sdk";

export type UpdateAcceptedReviewMetadataInput = {
  taskId: string;
  reviewSummary?: string;
  acceptanceNote?: string;
};

export type ModelGapBacklogSeedResult = {
  created: string[];
  skipped: Array<{ pathId: string; reason: string }>;
  gapCount: number;
};

type KnowledgeFeaturePath = {
  id?: string;
  featureId?: string;
  status?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  retestCondition?: string;
  resumeCondition?: string;
  rootCauseClass?: string;
  remediationStatus?: string;
  variantOfSpecId?: string;
  executionVariantId?: string;
  specCoverage?: {
    type?: string;
    specId?: string;
    variantId?: string;
    reason?: string;
  };
};

export type ProjectHygieneWarning = {
  kind: "stale-terminal-retry";
  taskId: string;
  taskState: string;
  pathId: string;
  pathStatus?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  message: string;
};

export type AksTaskPlanningPacket = TaskPlanningPacket & {
  project_hygiene_warnings?: ProjectHygieneWarning[];
};

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function normalizeTextValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeModelPath(entry: Record<string, unknown>): {
  id: string;
  status?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  retestCondition?: string;
  resumeCondition?: string;
} | null {
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id) return null;
  return {
    id,
    status: typeof entry.status === "string" ? entry.status : undefined,
    terminal: boolValue(entry.terminal) || undefined,
    verdictFinal: boolValue(entry.verdictFinal) || undefined,
    retestCondition: normalizeTextValue(entry.retestCondition),
    resumeCondition: normalizeTextValue(entry.resumeCondition),
  };
}

function loadModelPaths(config: TaskTreeConfig): Array<{
  id: string;
  status?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  retestCondition?: string;
  resumeCondition?: string;
}> {
  const model = readJsonFile<Record<string, unknown>>(
    join(config.projectDir, "model", "knowledge-map", "model.json"),
    {},
  );
  const featurePaths = Array.isArray(model.featurePaths)
    ? (model.featurePaths as Record<string, unknown>[])
    : [];
  const mirrorPaths = Array.isArray(model.paths)
    ? (model.paths as Record<string, unknown>[])
    : [];
  const byId = new Map<
    string,
    { id: string; status?: string; terminal?: boolean; verdictFinal?: boolean }
  >();
  for (const entry of [...featurePaths, ...mirrorPaths]) {
    const path = normalizeModelPath(entry);
    if (!path) continue;
    byId.set(path.id, { ...byId.get(path.id), ...path });
  }
  return [...byId.values()];
}

function taskSearchText(task: TaskNode): string {
  return JSON.stringify({
    id: task.id,
    goal: task.goal,
    inputs: task.inputs,
    outputs: task.outputs,
    acceptance: task.acceptance,
    conflict_scope: task.conflict_scope,
    depends_on: task.depends_on,
    context: task.context,
    blocker: task.blocker,
    trace: task.trace,
  }).toLowerCase();
}

function hasRetryIntent(text: string): boolean {
  return /\b(retry|rerun|re-run|reopen|re-open|reverify|re-verify|resume|unblock|execute|execution|verify|verification)\b/i.test(
    text,
  );
}

function normalizeComparableText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function holderTextMatchesResumeContract(
  text: string,
  path: Pick<KnowledgeFeaturePath, "retestCondition" | "resumeCondition">,
): boolean {
  const normalizedTaskText = normalizeComparableText(text);
  if (!normalizedTaskText) return false;

  const contractTexts = [path.resumeCondition, path.retestCondition]
    .map((value) => normalizeComparableText(value))
    .filter(Boolean);
  if (contractTexts.length === 0) return false;

  const tokenize = (value: string): string[] =>
    value
      .split(" ")
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length >= 4 &&
          ![
            "when",
            "only",
            "then",
            "that",
            "this",
            "with",
            "from",
            "into",
            "after",
            "before",
            "until",
            "exact",
            "blocked",
            "resume",
            "rerun",
            "replay",
            "path",
            "host",
            "gate",
            "open",
            "valid",
            "will",
            "must",
            "should",
            "project",
            "staging",
          ].includes(part),
      );

  const taskTokens = new Set(tokenize(normalizedTaskText));

  return contractTexts.some((contract) => {
    if (contract.length >= 24 && normalizedTaskText.includes(contract)) {
      return true;
    }
    const contractTokens = [...new Set(tokenize(contract))];
    if (contractTokens.length === 0) return false;
    const overlap = contractTokens.filter((token) => taskTokens.has(token));
    return overlap.length >= 3;
  });
}

function isExactBlockedPrerequisiteHolder(
  task: TaskNode,
  text: string,
  path: KnowledgeFeaturePath,
): boolean {
  const state = task.status ?? task.state ?? "backlog";
  if (state !== "blocked") return false;

  const holderSignals = [
    "exact environment blocker",
    "exact external prerequisite holder",
    "exact prerequisite holder",
    "remains only as the exact environment prerequisite holder",
    "resume only when",
    "blocked until",
    "external unblock required",
  ];
  const hasHolderSignal = holderSignals.some((signal) => text.includes(signal));
  if (!hasHolderSignal) return false;

  return holderTextMatchesResumeContract(text, path);
}

function projectHygieneWarnings(
  config: TaskTreeConfig,
): ProjectHygieneWarning[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const terminalPaths = loadModelPaths(config).filter(
      (path) => path.terminal === true || path.verdictFinal === true,
    );
    const warnings: ProjectHygieneWarning[] = [];
    for (const task of Object.values(tree.tasks ?? {})) {
      const state = task.status ?? task.state ?? "backlog";
      if (!isLeaf(task)) continue;
      if (state === "done") continue;
      const text = taskSearchText(task);
      if (!hasRetryIntent(text)) continue;
      for (const path of terminalPaths) {
        if (!text.includes(path.id.toLowerCase())) continue;
        if (isExactBlockedPrerequisiteHolder(task, text, path)) continue;
        warnings.push({
          kind: "stale-terminal-retry",
          taskId: task.id,
          taskState: state,
          pathId: path.id,
          pathStatus: path.status,
          terminal: path.terminal,
          verdictFinal: path.verdictFinal,
          message:
            "model verdict may be stale; owner should reconcile the model path before retry planning",
        });
      }
    }
    return warnings
      .sort(
        (a, b) =>
          a.taskId.localeCompare(b.taskId) || a.pathId.localeCompare(b.pathId),
      )
      .slice(0, 20);
  });
}

export function planningPacket(config: TaskTreeConfig): AksTaskPlanningPacket {
  const packet = sdkPlanningPacket(config) as AksTaskPlanningPacket;
  const warnings = projectHygieneWarnings(config);
  if (warnings.length > 0) packet.project_hygiene_warnings = warnings;
  return packet;
}

function listArtifactStems(root: string, extension: string): Set<string> {
  const stems = new Set<string>();
  const visit = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const path = join(dir, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && extname(path) === extension) {
        const name = entry.slice(0, -extension.length);
        if (name !== "index") stems.add(name);
      }
    }
  };
  visit(root);
  return stems;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^path[.-]/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function artifactStemCandidates(path: KnowledgeFeaturePath): string[] {
  const candidates = [
    slugify(path.id ?? ""),
    slugify(path.featureId ?? ""),
  ].filter(Boolean);
  const expanded = candidates.flatMap((candidate) => [
    candidate,
    candidate.replace(/^managedsystem-pool-/, "managedsystem-"),
    candidate.replace(/^virtualmachines-agentpool-/, "virtualmachines-"),
    candidate.replace(/^machines-agentpool-/, "machines-"),
  ]);
  return [...new Set(expanded.filter(Boolean))];
}

function findArtifactStem(
  path: KnowledgeFeaturePath,
  specs: Set<string>,
  replays: Set<string>,
): string | null {
  for (const candidate of artifactStemCandidates(path)) {
    if (specs.has(candidate) || replays.has(candidate)) return candidate;
  }
  return null;
}

function openTaskAlreadyCoversPath(
  tree: TaskTree,
  path: KnowledgeFeaturePath,
  stem: string | null,
): boolean {
  const signals = [path.id, path.featureId, stem]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (signals.length === 0) return false;
  return Object.values(tree.tasks).some((task) => {
    if (task.status === "done") return false;
    const haystack = JSON.stringify({
      id: task.id,
      goal: task.goal,
      inputs: task.inputs,
      outputs: task.outputs,
      conflict_scope: task.conflict_scope,
      context: task.context,
      blocker: task.blocker,
    }).toLowerCase();
    return signals.some((signal) => haystack.includes(signal));
  });
}

function nextAvailableTaskId(tree: TaskTree, baseId: string): string {
  let id = baseId;
  let suffix = 2;
  while (tree.tasks[id]) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }
  return id;
}

function statusPriority(status: string | undefined): number {
  if (status === "unknown" || status === "source-enumerated") return 0;
  if (status === "fail") return 1;
  if (status === "blocked-infra") return 2;
  if (status === "blocked") return 3;
  return 4;
}

function appendSeededTask(
  tree: TaskTree,
  parent: TaskNode,
  task: TaskNode,
): void {
  tree.tasks[task.id] = task;
  parent.children = [
    ...new Set([...normalizeStringArray(parent.children), task.id]),
  ];
}

export function updateAcceptedReviewMetadata(
  config: TaskTreeConfig,
  input: UpdateAcceptedReviewMetadataInput,
): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const hasReviewSummary = typeof input.reviewSummary === "string";
    const hasAcceptanceNote = typeof input.acceptanceNote === "string";
    if (!hasReviewSummary && !hasAcceptanceNote) {
      throw new Error(
        "Provide at least one of reviewSummary or acceptanceNote",
      );
    }

    if (hasReviewSummary) {
      const reviewSummary = input.reviewSummary?.trim() ?? "";
      if (!reviewSummary) throw new Error("reviewSummary cannot be empty");
      task.trace = {
        ...(task.trace ?? {}),
        review_summary: reviewSummary,
      };
    }

    if (hasAcceptanceNote) {
      const acceptanceNote = input.acceptanceNote?.trim() ?? "";
      if (!acceptanceNote) throw new Error("acceptanceNote cannot be empty");
      const context =
        task.context &&
        typeof task.context === "object" &&
        !Array.isArray(task.context)
          ? task.context
          : {};
      task.context = {
        ...context,
        acceptance_note: acceptanceNote,
      };
    }

    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_accepted_review_metadata_updated",
      task_id: task.id,
      review_summary_updated: hasReviewSummary,
      acceptance_note_updated: hasAcceptanceNote,
    });
    return task;
  });
}

export function seedModelGapBacklog(
  config: TaskTreeConfig,
  input: {
    limit?: number;
    reason?: string;
    prefer?: "execution" | "source-spec";
  } = {},
): ModelGapBacklogSeedResult {
  const model = readJsonFile<{ featurePaths?: KnowledgeFeaturePath[] }>(
    join(config.projectDir, "model", "knowledge-map", "model.json"),
    {},
  );
  const paths = Array.isArray(model.featurePaths) ? model.featurePaths : [];
  const gaps = paths
    .filter(
      (path) =>
        path.id &&
        path.featureId &&
        !["pass", "staging-pass"].includes(path.status ?? "unknown"),
    )
    .sort(
      (a, b) =>
        statusPriority(a.status) - statusPriority(b.status) ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    );
  const specs = listArtifactStems(join(config.projectDir, "specs"), ".json");
  const replays = listArtifactStems(join(config.projectDir, "replays"), ".ts");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const limit = Math.max(0, input.limit ?? 2);
  if (limit === 0) return { created: [], skipped: [], gapCount: gaps.length };

  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const created: string[] = [];
    const skipped: ModelGapBacklogSeedResult["skipped"] = [];
    const runnerParent = tree.tasks["spec-runner-and-replays"];
    const sourceParent =
      tree.tasks["go-e2ev3-source-discovery"] ??
      tree.tasks["feature-knowledge-and-specs"];
    if (!runnerParent && !sourceParent)
      return {
        created,
        skipped: gaps.map((path) => ({
          pathId: path.id ?? "(unknown)",
          reason: "no-parent-task",
        })),
        gapCount: gaps.length,
      };

    const now = new Date().toISOString();
    for (const path of gaps) {
      if (created.length >= limit) break;
      const pathId = path.id ?? "";
      const featureId = path.featureId ?? "";
      const stem = findArtifactStem(path, specs, replays);
      if (path.status === "blocked" || path.status === "blocked-infra") {
        skipped.push({ pathId, reason: "blocked-status" });
        continue;
      }
      if (
        path.specCoverage?.type === "execution-variant" ||
        path.variantOfSpecId ||
        path.executionVariantId
      ) {
        skipped.push({ pathId, reason: "execution-variant-metadata" });
        continue;
      }
      if (path.terminal === true || path.verdictFinal === true) {
        skipped.push({ pathId, reason: "terminal-path" });
        continue;
      }
      const terminalRootCauses = [
        "cli-bug",
        "product-bug",
        "product-gap",
        "product_constraint",
      ];
      const terminalRemediationStatuses = ["awaiting-", "terminal-"];
      if (
        path.status === "fail" &&
        path.rootCauseClass &&
        terminalRootCauses.includes(path.rootCauseClass) &&
        path.remediationStatus &&
        terminalRemediationStatuses.some((p) =>
          (path.remediationStatus ?? "").startsWith(p),
        )
      ) {
        skipped.push({ pathId, reason: "terminal-known-product-bug" });
        continue;
      }
      if (openTaskAlreadyCoversPath(tree, path, stem)) {
        skipped.push({ pathId, reason: "already-covered-by-open-task" });
        continue;
      }

      const hasReplay = Boolean(stem && replays.has(stem));
      const hasSpec = Boolean(stem && specs.has(stem));
      const preferSourceSpec = input.prefer === "source-spec";
      const parent =
        !preferSourceSpec && (hasReplay || hasSpec)
          ? runnerParent
          : sourceParent;
      if (!parent) {
        skipped.push({ pathId, reason: "no-parent-task" });
        continue;
      }

      const baseSlug = slugify(featureId || pathId).slice(0, 70) || "model-gap";
      const taskId = nextAvailableTaskId(
        tree,
        !preferSourceSpec && (hasReplay || hasSpec)
          ? `${baseSlug}-staging-frontier-${today}`
          : `${baseSlug}-source-spec-frontier-${today}`,
      );
      const artifactInputs = [
        hasSpec ? `specs/${stem}.json` : undefined,
        hasReplay ? `replays/${stem}.ts` : undefined,
      ].filter((value): value is string => Boolean(value));
      const executionTask = !preferSourceSpec && (hasReplay || hasSpec);
      const task: TaskNode = {
        id: taskId,
        parent_id: parent.id,
        state: "backlog",
        status: "backlog",
        kind: "domain_leaf",
        priority: path.status === "unknown" ? "P1" : "P2",
        owner: config.worker,
        children: [],
        goal: executionTask
          ? [
              `Close the knowledge-model gap for ${pathId} by running or repairing the existing staging REST test path.`,
              artifactInputs.length
                ? `Use ${artifactInputs.join(" and ")} through the project runner.`
                : "Use the project runner and existing domain artifacts.",
              "Produce real execution feedback, not a dry-run-only conclusion.",
            ].join(" ")
          : [
              `Explore source/material for ${pathId} and build up the source-grounded spec/replay frontier before scheduling more slow staging execution.`,
              artifactInputs.length
                ? `Use existing artifacts as starting context: ${artifactInputs.join(" and ")}.`
                : "Create missing feature/spec/replay artifacts from source material.",
              "Feed the result into the runner lane for later high-value verification.",
            ].join(" "),
        inputs: artifactInputs,
        outputs: executionTask
          ? [
              "runs/executions/",
              "evidence/archive/",
              "model/knowledge-map/model.json",
            ]
          : ["features/", "specs/", "replays/", "evidence/archive/"],
        acceptance: executionTask
          ? [
              "A live staging REST run result or precise runner-fix result is recorded under runs/executions/.",
              "Failure is classified as product, test, runner, or environment with evidence and cleanup state.",
              "The knowledge model or a model-update proposal reflects the path verdict.",
            ]
          : [
              "Feature/source packet identifies the source scenario and expected behavior.",
              "A runnable spec and replay script are created or an exact external blocker is recorded.",
              "The new work is linked to the knowledge-model path and ready for runner verification.",
            ],
        forbidden: [
          "Do not treat dry-run output as live verification.",
          "Do not hard-code credentials, subscription IDs, or tenant-specific secrets.",
          "Do not bypass project runner artifacts when executing live staging work.",
        ],
        conflict_scope: [
          `feature:${featureId}`,
          `path:${pathId}`,
          ...(stem ? [`artifact:${stem}`] : []),
        ],
        context: {
          seeded_by: "model-gap-frontier",
          seed_reason: input.reason ?? "capacity-underfilled-with-gaps",
          model_path_id: pathId,
          feature_id: featureId,
          model_status: path.status ?? "unknown",
          spec: hasSpec ? `specs/${stem}.json` : undefined,
          replay: hasReplay ? `replays/${stem}.ts` : undefined,
          seed_preference: input.prefer ?? "execution",
        },
        trace: {
          created_at: now,
          created_by: "model-gap-frontier-seeder",
        },
      };
      appendSeededTask(tree, parent, task);
      created.push(task.id);
    }

    if (created.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "model_gap_backlog_seeded",
        task_ids: created,
        reason: input.reason ?? "capacity-underfilled-with-gaps",
      });
    }

    return { created, skipped, gapCount: gaps.length };
  });
}
