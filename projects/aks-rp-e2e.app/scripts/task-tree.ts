import { existsSync } from "node:fs";
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
  readTask,
  rejectTaskReview,
  requeueStaleActiveTasks,
  repairTaskTreeRollups,
  rollupParent,
  summarizeTaskTree,
  updateAcceptedReviewMetadata,
  updateTaskOutputs,
  updateTaskText,
  taskTreeConfig,
  unblockTask,
  type TaskCompletionClaim,
  writeKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";

function usage(): never {
  console.error(`Usage:
  bun run task-tree summary
  bun run task-tree packet
  bun run task-tree kanban
  bun run task-tree kanban-snapshot
  bun run task-tree repair-rollups
  bun run task-tree compact-done [--limit N]
  bun run task-tree rollup-parent <parent-id> --summary "..." [--archive-done <child-id> ...] [--limit N]
  bun run task-tree frontier
  bun run task-tree confirm-runnable [--limit N]
  bun run task-tree add <task-id> --parent <task-id> --goal "..." --output <path> --acceptance "..." [--state backlog|blocked]
  bun run task-tree mark-done <task-id> --summary "review accepted"
  bun run task-tree assign <task-id> [--worker agent-name]
  bun run task-tree assignments
  bun run task-tree drain-assignments
  bun run task-tree show <task-id>
  bun run task-tree complete <task-id> --result done|partial|blocked --summary "..."
  bun run task-tree set-outputs <task-id> --output <path> [--output <path> ...]
  bun run task-tree update-text <task-id> [--goal "..."] [--acceptance "..."] [--acceptance "..."] [--blocker "..."] [--clear-blocker]
  bun run task-tree unblock <task-id> --reason "blocker resolved"
  bun run task-tree update-accepted-review <task-id> [--review-summary "..."] [--acceptance-note "..."]
  bun run task-tree reject-review <task-id> --reason "acceptance not met" [--fresh-session]
  bun run task-tree requeue-active <task-id> [--reason "session not running"] [--fresh-session]

Environment:
  APP_DIR=/app/projects/aks-rp-e2e.app
  PROJECT_DIR=/app/projects/aks-rp-e2e
  WORKER=aks-explorer
  MAX_CONCURRENT=5`);
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

const appDir = resolve(
  process.env.APP_DIR ??
    dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, ""),
);
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(appDir, "..", "aks-rp-e2e"),
);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "aks-explorer",
  maxConcurrent: numberOption("--max", Number(process.env.MAX_CONCURRENT ?? 5)),
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
  console.log(
    JSON.stringify(
      createTask(config, {
        id: taskId,
        parentId,
        state: stateOption(),
        kind: option("--kind") ?? "domain_leaf",
        priority: priorityOption(),
        owner: option("--owner") ?? process.env.WORKER ?? "aks-explorer",
        workflow: option("--workflow"),
        goal,
        inputs: repeatedStringOption("--input"),
        outputs,
        acceptance,
        forbidden: repeatedStringOption("--forbidden"),
        conflict_scope: commaListOption("--conflict-scope"),
        depends_on: commaListOption("--depends-on"),
        context: contextOption(),
        blocker: option("--blocker"),
      }),
      null,
      2,
    ),
  );
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
} else if (command === "update-text") {
  const taskId = process.argv[3];
  if (!taskId) usage();
  const goal = option("--goal");
  const acceptance = repeatedStringOption("--acceptance");
  const blocker = option("--blocker");
  const clearBlocker = hasFlag("--clear-blocker");
  if (
    !goal &&
    acceptance.length === 0 &&
    blocker === undefined &&
    !clearBlocker
  )
    usage();
  console.log(
    JSON.stringify(
      updateTaskText(config, {
        taskId,
        goal,
        acceptance: acceptance.length ? acceptance : undefined,
        blocker,
        clearBlocker,
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
