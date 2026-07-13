import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignTask,
  compactDoneLeaves,
  completeTask,
  createTask,
  drainTaskAssignments,
  confirmRunnableBacklogLeaves,
  peekTaskAssignments,
  kanbanTaskTreeState,
  markTaskDone,
  planningPacket,
  pruneMissingChildren,
  readTask,
  rejectTaskReview,
  refreshBlockedWait,
  requeueStaleActiveTasks,
  repairTaskTreeRollups,
  rollupParent,
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  updateAcceptedReviewMetadata,
  updateArchivedTaskOutputs,
  updateArchivedTaskEvidence,
  updateTaskOutputs,
  updateTaskText,
  taskTreeConfig,
  unblockTask,
  type TaskCompletionClaim,
  writeKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

function usage(): never {
  console.error(`Usage:
  bun run task-tree summary
  bun run task-tree packet
  bun run task-tree kanban
  bun run task-tree kanban-snapshot
  bun run task-tree repair-rollups
  bun run task-tree repair-blocked-contracts [--dry-run]
  bun run task-tree prune-missing-children <parent-id>
  bun run task-tree compact-done [--limit N]
  bun run task-tree rollup-parent <parent-id> --summary "..." [--archive-done <child-id> ...] [--limit N]
  bun run task-tree frontier
  bun run task-tree confirm-runnable [--limit N]
  bun run task-tree add <task-id> --parent <task-id> --goal "..." --output <path> --acceptance "..." [--state backlog|blocked] [--blocker "..."] [--blocker-json '{"condition":"..."}'] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO] [--next-check-at ISO] [--fallback-at ISO] [--fallback-action "..."]
  bun run task-tree mark-done <task-id> --summary "review accepted" [--resolution completed|replaced|cancelled|terminal] [--review-decision accept|followup|blocked|escalate]
  bun run task-tree assign <task-id> [--worker agent-name]
  bun run task-tree assignments
  bun run task-tree drain-assignments
  bun run task-tree show <task-id>
  bun run task-tree complete <task-id> --result done|partial|blocked --summary "..."
  bun run task-tree set-outputs <task-id> --output <path> [--output <path> ...]
  bun run task-tree set-archived-outputs <task-id> [--archive-file tasks/archive/done-leaves-<timestamp>.json] --output <path> [--output <path> ...]
  bun run task-tree set-archived-evidence <task-id> [--archive-file tasks/archive/done-leaves-<timestamp>.json] --evidence <path> [--evidence <path> ...]
  bun run task-tree update-text <task-id> [--goal "..."] [--acceptance "..."] [--acceptance "..."] [--blocker "..."] [--blocker-json '{"condition":"..."}'] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO] [--next-check-at ISO] [--fallback-at ISO] [--fallback-action "..."] [--clear-blocker]
  bun run task-tree refresh-blocked-wait <task-id> --blocker "..." --resume-condition "..." --summary "..." [--blocker-category external-wait] [--blocker-owner owner] [--next-check-at ISO] [--fallback-at ISO] [--fallback-action "..."]
  bun run task-tree unblock <task-id> --reason "blocker resolved"
  bun run task-tree update-accepted-review <task-id> [--review-summary "..."] [--acceptance-note "..."]
  bun run task-tree reject-review <task-id> --reason "acceptance not met" [--fresh-session]
  bun run task-tree requeue-active <task-id> [--reason "session not running"] [--fresh-session]

Environment:
  APP_DIR=/app/projects/aks-rp-e2e.app
  PROJECT_DIR=/app/projects/aks-rp-e2e
  WORKER=aks-explorer
  MAX_CONCURRENT=5

Default maxConcurrent resolution when --max is omitted:
  1. MAX_CONCURRENT env
  2. app project.json policy.maxConcurrent
  3. fallback 1 when no explicit policy is present`);
  process.exit(2);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function numberOption(name: string, fallback: number): number {
  const raw = option(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readProjectPolicyMaxConcurrent(appDir: string): number | null {
  const projectJsonPath = join(appDir, "project.json");
  try {
    const parsed = JSON.parse(readFileSync(projectJsonPath, "utf-8")) as {
      policy?: { maxConcurrent?: unknown };
    };
    const configured = parsed?.policy?.maxConcurrent;
    return typeof configured === "number" && Number.isFinite(configured)
      ? Math.max(1, Math.trunc(configured))
      : null;
  } catch {
    return null;
  }
}

function repeatedStringOption(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index++) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index++;
    }
  }
  return values.map((value) => value.trim()).filter(Boolean);
}

function commaListOption(name: string): string[] {
  return repeatedStringOption(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function stateOption(): "backlog" | "blocked" {
  const raw = option("--state") ?? option("--status") ?? "backlog";
  if (raw === "blocked") return "blocked";
  if (raw === "backlog" || raw === "ready" || raw === "proposed")
    return "backlog";
  throw new Error(`Invalid --state ${raw}; expected backlog or blocked`);
}

function defaultTaskOwner(input: {
  taskId?: string;
  parentId?: string;
  explicitOwner?: string;
  fallbackOwner?: string;
}): string {
  const explicitOwner = input.explicitOwner?.trim();
  if (explicitOwner) return explicitOwner;

  const taskId = input.taskId?.trim() ?? "";
  const parentId = input.parentId?.trim() ?? "";
  if (
    taskId === "ops" ||
    taskId.startsWith("ops/") ||
    taskId.startsWith("ops-") ||
    parentId === "ops" ||
    parentId.startsWith("ops/") ||
    parentId.startsWith("ops-")
  ) {
    return "app-ops";
  }

  return input.fallbackOwner?.trim() || "aks-explorer";
}

function priorityOption(): "P0" | "P1" | "P2" | "P3" {
  const raw = option("--priority") ?? "P2";
  if (raw === "P0" || raw === "P1" || raw === "P2" || raw === "P3") return raw;
  throw new Error(`Invalid --priority ${raw}; expected P0, P1, P2, or P3`);
}

function contextOption(): Record<string, unknown> | undefined {
  const raw = option("--context-json");
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("--context-json must be a JSON object");
  return parsed as Record<string, unknown>;
}

function blockerOptions(): {
  blocker?: string | Record<string, unknown>;
  blockerCategory?: string;
  blockerOwner?: string;
  resumeCondition?: string;
  resumeAt?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
} {
  const blockerJson = option("--blocker-json");
  let parsedBlocker: Record<string, unknown> | undefined;
  if (blockerJson) {
    const parsed = JSON.parse(blockerJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("--blocker-json must be a JSON object");
    }
    parsedBlocker = parsed as Record<string, unknown>;
  }
  return {
    blocker: parsedBlocker ?? option("--blocker"),
    blockerCategory: option("--blocker-category"),
    blockerOwner: option("--blocker-owner"),
    resumeCondition: option("--resume-condition"),
    resumeAt: option("--resume-at"),
    nextCheckAt: option("--next-check-at"),
    fallbackAt: option("--fallback-at"),
    fallbackAction: option("--fallback-action"),
  };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(
  record: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function objectField(
  record: Record<string, unknown> | null,
  keys: string[],
): Record<string, unknown> | null {
  if (!record) return null;
  for (const key of keys) {
    const nested = recordValue(record[key]);
    if (nested) return nested;
  }
  return null;
}

function taskTrace(task: TaskNode): Record<string, unknown> | null {
  return recordValue((task as { trace?: unknown }).trace);
}

function blockerText(blocker: unknown): string {
  if (typeof blocker === "string") return blocker.trim();
  const record = recordValue(blocker);
  if (!record) return "";
  return [
    stringField(record, ["condition"]),
    stringField(record, ["resume_condition", "resumeCondition"])
      ? `Resume: ${stringField(record, ["resume_condition", "resumeCondition"])}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function conditionText(text: string): string {
  return text.replace(/\s+Resume:\s+.*$/is, "").trim() || text.trim();
}

function resumeCondition(
  text: string,
  blocker: Record<string, unknown> | null,
) {
  const existing = stringField(blocker, [
    "resume_condition",
    "resumeCondition",
    "waitingCondition",
  ]);
  if (existing) return existing;
  const match = text.match(/\bResume:\s*(.+)$/is);
  if (match?.[1]?.trim()) return match[1].trim();
  return "Resume when the stated blocker condition is no longer true and the owner records the concrete evidence.";
}

function defaultWaitingFor(taskId: string): Record<string, unknown> {
  return {
    type: "blocker.resolved",
    taskId,
  };
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

function normalizeBlockedTaskContract(task: TaskNode, now: string): boolean {
  const taskId = task.id;
  if (!taskId || (task.status ?? task.state) !== "blocked") return false;
  if ((task.children ?? []).length > 0) return false;

  const blocker = recordValue(task.blocker);
  const text = blockerText(task.blocker);
  if (!text && blocker) return false;

  const condition = stringField(blocker, ["condition"]) || conditionText(text);
  const existingWaitingFor = objectField(blocker, ["waiting_for", "waitingFor"]);
  const existingOwner = stringField(blocker, ["owner"]);
  const shouldUseAdoOwner =
    stringField(existingWaitingFor, ["type"]) ===
      "ado.pipeline_run.completed" &&
    (existingOwner.toLowerCase() === "human" || !existingOwner);

  let normalizedBlocker = blocker ? { ...blocker } : null;
  let normalizedChanged = false;
  if (shouldUseAdoOwner && normalizedBlocker) {
    normalizedBlocker = {
      ...normalizedBlocker,
      owner: "ado",
    };
    normalizedChanged = true;
  }

  const blockerForContract = normalizedBlocker ?? blocker;
  const hasFullContract =
    !!objectField(blockerForContract, ["waiting_for", "waitingFor"]) &&
    !!objectField(blockerForContract, ["observed_by", "observedBy"]) &&
    !!stringField(blockerForContract, [
      "observation_method",
      "observationMethod",
    ]) &&
    !!stringField(blockerForContract, ["next_check_at", "nextCheckAt"]) &&
    !!stringField(blockerForContract, ["owner"]) &&
    !!stringField(blockerForContract, ["fallback_at", "fallbackAt"]) &&
    !!stringField(blockerForContract, ["fallback_action", "fallbackAction"]);

  if (hasFullContract) {
    if (!normalizedChanged || !normalizedBlocker) return false;
    (task as { blocker?: unknown }).blocker = normalizedBlocker;
    task.trace = {
      ...(recordValue(task.trace) ?? {}),
      blocked_contract_repaired_at: now,
    } as typeof task.trace;
    return true;
  }

  const trace = taskTrace(task);
  const blockedAt =
    stringField(blockerForContract, ["blocked_at", "blockedAt"]) ||
    stringField(trace, ["blocked_at", "created_at", "assigned_at"]) ||
    now;
  const owner =
    stringField(blockerForContract, ["owner"]) ||
    (typeof task.owner === "string" && task.owner.trim()
      ? task.owner.trim()
      : "aks-explorer");
  (task as { blocker?: unknown }).blocker = {
    ...(blockerForContract ?? {}),
    condition,
    category:
      stringField(blockerForContract, ["category"]) ||
      "external-wait",
    owner,
    blocked_at: blockedAt,
    waiting_for:
      objectField(blockerForContract, ["waiting_for", "waitingFor"]) ??
      defaultWaitingFor(taskId),
    observed_by: objectField(blockerForContract, [
      "observed_by",
      "observedBy",
    ]) ?? {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      stringField(blockerForContract, [
        "observation_method",
        "observationMethod",
      ]) ||
      "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    next_check_at:
      stringField(blockerForContract, ["next_check_at", "nextCheckAt"]) ||
      addMinutes(now, 10),
    resume_condition: resumeCondition(text, blockerForContract),
    fallback_at:
      stringField(blockerForContract, ["fallback_at", "fallbackAt"]) ||
      addHours(now, 24),
    fallback_action:
      stringField(blockerForContract, ["fallback_action", "fallbackAction"]) ||
      "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.",
  };
  task.trace = {
    ...(recordValue(task.trace) ?? {}),
    blocked_contract_repaired_at: now,
  } as typeof task.trace;
  return true;
}

function repairBlockedContracts(dryRun: boolean) {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const now = new Date().toISOString();
    const repaired: string[] = [];
    const unchanged: string[] = [];
    for (const task of Object.values(tree.tasks ?? {})) {
      const taskId = task.id;
      if (!taskId || (task.status ?? task.state) !== "blocked") continue;
      if ((task.children ?? []).length > 0) continue;
      const blocker = recordValue(task.blocker);
      const text = blockerText(task.blocker);
      if (!text && blocker) {
        unchanged.push(taskId);
        continue;
      }
      if (normalizeBlockedTaskContract(task, now)) {
        repaired.push(taskId);
      } else {
        unchanged.push(taskId);
      }
    }
    if (!dryRun && repaired.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
    return {
      dryRun,
      treePath: config.treePath,
      repairedCount: repaired.length,
      unchangedCount: unchanged.length,
      repaired,
      unchanged,
    };
  });
}

const appDir = resolve(
  process.env.APP_DIR ??
    dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, ""),
);
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(appDir, "..", "aks-rp-e2e"),
);
const policyMaxConcurrent = readProjectPolicyMaxConcurrent(appDir);
const fallbackMaxConcurrent =
  Number.parseInt(process.env.MAX_CONCURRENT ?? "", 10) ||
  policyMaxConcurrent ||
  1;
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "aks-explorer",
  maxConcurrent: numberOption("--max", fallbackMaxConcurrent),
});

if (!existsSync(config.treePath)) {
  console.error(`Task tree not found: ${config.treePath}`);
  process.exit(1);
}

const command = process.argv[2];
if (!command) usage();

if (command === "summary") {
  console.log(JSON.stringify(summarizeTaskTree(config), null, 2));
} else if (command === "packet") {
  console.log(JSON.stringify(planningPacket(config), null, 2));
} else if (command === "kanban") {
  console.log(JSON.stringify(kanbanTaskTreeState(config).kanban, null, 2));
} else if (command === "kanban-snapshot") {
  console.log(JSON.stringify(writeKanbanSnapshot(config), null, 2));
} else if (command === "repair-rollups") {
  console.log(JSON.stringify(repairTaskTreeRollups(config), null, 2));
} else if (command === "repair-blocked-contracts") {
  console.log(
    JSON.stringify(repairBlockedContracts(hasFlag("--dry-run")), null, 2),
  );
} else if (command === "prune-missing-children") {
  const parentId = process.argv[3];
  if (!parentId) usage();
  console.log(
    JSON.stringify(
      pruneMissingChildren(config, {
        parentId,
      }),
      null,
      2,
    ),
  );
} else if (command === "compact-done") {
  console.log(
    JSON.stringify(
      compactDoneLeaves(config, {
        limit: numberOption("--limit", 200),
        reason: option("--reason") ?? "operator requested task tree roll-up",
      }),
      null,
      2,
    ),
  );
} else if (command === "rollup-parent") {
  const parentId = process.argv[3];
  const summary = option("--summary");
  if (!parentId || !summary) usage();
  console.log(
    JSON.stringify(
      rollupParent(config, {
        parentId,
        summary,
        taskIds: repeatedStringOption("--archive-done"),
        limit: numberOption("--limit", 200),
        reason: option("--reason") ?? "owner rolled up completed child tasks",
      }),
      null,
      2,
    ),
  );
} else if (command === "frontier") {
  console.log(JSON.stringify(summarizeTaskTree(config).frontier, null, 2));
} else if (command === "confirm-runnable" || command === "promote-clear") {
  console.log(
    JSON.stringify(
      confirmRunnableBacklogLeaves(config, numberOption("--limit", 10)),
      null,
      2,
    ),
  );
} else if (command === "show") {
  const taskId = process.argv[3];
  if (!taskId) usage();
  const task = readTask(config, taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }
  console.log(JSON.stringify(task, null, 2));
} else if (command === "assign") {
  const taskId = process.argv[3];
  if (!taskId) usage();
  console.log(
    JSON.stringify(
      assignTask(config, {
        taskId,
        worker: option("--worker") ?? process.env.WORKER ?? "aks-explorer",
        attemptId: option("--attempt-id"),
      }),
      null,
      2,
    ),
  );
} else if (command === "assignments") {
  console.log(JSON.stringify(peekTaskAssignments(config), null, 2));
} else if (command === "drain-assignments") {
  console.log(JSON.stringify(drainTaskAssignments(config), null, 2));
} else if (command === "add") {
  const taskId = process.argv[3];
  const parentId = option("--parent");
  const goal = option("--goal");
  const outputs = repeatedStringOption("--output");
  const acceptance = repeatedStringOption("--acceptance");
  if (
    !taskId ||
    !parentId ||
    !goal ||
    outputs.length === 0 ||
    acceptance.length === 0
  )
    usage();
  const created = createTask(config, {
    id: taskId,
    parentId,
    state: stateOption(),
    kind: option("--kind") ?? "domain_leaf",
    priority: priorityOption(),
    owner: defaultTaskOwner({
      taskId,
      parentId,
      explicitOwner: option("--owner"),
      fallbackOwner: process.env.WORKER ?? "aks-explorer",
    }),
    workflow: option("--workflow"),
    goal,
    inputs: repeatedStringOption("--input"),
    outputs,
    acceptance,
    forbidden: repeatedStringOption("--forbidden"),
    conflict_scope: commaListOption("--conflict-scope"),
    depends_on: commaListOption("--depends-on"),
    context: contextOption(),
    ...blockerOptions(),
  });
  if ((created.status ?? created.state) === "blocked") {
    withTreeLock(config, () => {
      const tree = readTaskTree(config);
      const task = tree.tasks[created.id];
      if (!task) return;
      if (normalizeBlockedTaskContract(task, new Date().toISOString())) {
        saveTaskTreeWithKanbanSnapshot(config, tree);
      }
    });
  }
  console.log(JSON.stringify(readTask(config, taskId) ?? created, null, 2));
} else if (command === "mark-done") {
  const taskId = process.argv[3];
  const summary = option("--summary");
  if (!taskId || !summary) usage();
  console.log(
    JSON.stringify(
      markTaskDone(config, {
        taskId,
        summary,
        resolution: option("--resolution"),
        reviewDecision: option("--review-decision"),
      }),
      null,
      2,
    ),
  );
} else if (command === "reject-review") {
  const taskId = process.argv[3];
  const reason = option("--reason") ?? option("--summary");
  if (!taskId || !reason) usage();
  console.log(
    JSON.stringify(
      rejectTaskReview(config, {
        taskId,
        reason,
        freshSession: hasFlag("--fresh-session"),
      }),
      null,
      2,
    ),
  );
} else if (command === "requeue-active") {
  const taskId = process.argv[3];
  if (!taskId) usage();
  console.log(
    JSON.stringify(
      requeueStaleActiveTasks(config, {
        taskIds: [taskId],
        reason: option("--reason") ?? "operator requested active-task retry",
        freshSession: hasFlag("--fresh-session"),
      }),
      null,
      2,
    ),
  );
} else if (command === "complete") {
  const taskId = process.argv[3];
  const result =
    (option("--result") as TaskCompletionClaim | undefined) ??
    (option("--claim") as TaskCompletionClaim | undefined);
  const summary = option("--summary");
  if (
    !taskId ||
    !summary ||
    !result ||
    !["done", "partial", "blocked"].includes(result)
  )
    usage();
  const evidence = option("--evidence")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  console.log(
    JSON.stringify(
      completeTask(config, {
        taskId,
        claim: result,
        summary,
        evidence,
      }),
      null,
      2,
    ),
  );
} else if (command === "set-outputs") {
  const taskId = process.argv[3];
  const outputs = repeatedStringOption("--output");
  if (!taskId || outputs.length === 0) usage();
  console.log(
    JSON.stringify(
      updateTaskOutputs(config, {
        taskId,
        outputs,
      }),
      null,
      2,
    ),
  );
} else if (command === "set-archived-outputs") {
  const taskId = process.argv[3];
  const outputs = repeatedStringOption("--output");
  if (!taskId || outputs.length === 0) usage();
  console.log(
    JSON.stringify(
      updateArchivedTaskOutputs(config, {
        taskId,
        outputs,
        archiveFile: option("--archive-file"),
      }),
      null,
      2,
    ),
  );
} else if (command === "set-archived-evidence") {
  const taskId = process.argv[3];
  const evidence = repeatedStringOption("--evidence");
  if (!taskId || evidence.length === 0) usage();
  console.log(
    JSON.stringify(
      updateArchivedTaskEvidence(config, {
        taskId,
        evidence,
        archiveFile: option("--archive-file"),
      }),
      null,
      2,
    ),
  );
} else if (command === "update-text") {
  const taskId = process.argv[3];
  if (!taskId) usage();
  const goal = option("--goal");
  const acceptance = repeatedStringOption("--acceptance");
  const blocker = blockerOptions();
  const clearBlocker = hasFlag("--clear-blocker");
  if (
    !goal &&
    acceptance.length === 0 &&
    Object.values(blocker).every((value) => value === undefined) &&
    !clearBlocker
  )
    usage();
  console.log(
    JSON.stringify(
      updateTaskText(config, {
        taskId,
        goal,
        acceptance: acceptance.length ? acceptance : undefined,
        ...blocker,
        clearBlocker,
      }),
      null,
      2,
    ),
  );
} else if (command === "refresh-blocked-wait") {
  const taskId = process.argv[3];
  const condition = option("--blocker");
  const resumeCondition = option("--resume-condition");
  const summary = option("--summary");
  if (!taskId || !condition || !resumeCondition || !summary) usage();
  console.log(
    JSON.stringify(
      refreshBlockedWait(config, {
        taskId,
        condition,
        resumeCondition,
        summary,
        category: option("--blocker-category"),
        owner: option("--blocker-owner"),
        nextCheckAt: option("--next-check-at"),
        fallbackAt: option("--fallback-at"),
        fallbackAction: option("--fallback-action"),
      }),
      null,
      2,
    ),
  );
} else if (command === "unblock") {
  const taskId = process.argv[3];
  const reason = option("--reason") ?? option("--summary");
  if (!taskId || !reason) usage();
  console.log(
    JSON.stringify(
      unblockTask(config, {
        taskId,
        reason,
      }),
      null,
      2,
    ),
  );
} else if (command === "update-accepted-review") {
  const taskId = process.argv[3];
  if (!taskId) usage();
  const reviewSummary = option("--review-summary");
  const acceptanceNote = option("--acceptance-note");
  if (reviewSummary === undefined && acceptanceNote === undefined) usage();
  console.log(
    JSON.stringify(
      updateAcceptedReviewMetadata(config, {
        taskId,
        reviewSummary,
        acceptanceNote,
      }),
      null,
      2,
    ),
  );
} else {
  usage();
}
