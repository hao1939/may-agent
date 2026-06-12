import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignTask,
  completeTask,
  createTask,
  drainTaskAssignments,
  peekTaskAssignments,
  kanbanTaskTreeState,
  planningPacket,
  promoteClearProposedLeaves,
  readTask,
  summarizeTaskTree,
  taskTreeConfig,
  type TaskCompletionClaim,
  writeKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";

function usage(): never {
  console.error(`Usage:
  bun run task-tree summary
  bun run task-tree packet
  bun run task-tree kanban
  bun run task-tree kanban-snapshot
  bun run task-tree frontier
  bun run task-tree promote-clear [--limit N]
  bun run task-tree add <task-id> --parent <task-id> --goal "..." --output <path> --acceptance "..." [--status proposed|backlog|ready|blocked]
  bun run task-tree assign <task-id> [--worker agent-name]
  bun run task-tree assignments
  bun run task-tree drain-assignments
  bun run task-tree show <task-id>
  bun run task-tree complete <task-id> --result done|partial|blocked --summary "..."

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

function statusOption(): "proposed" | "backlog" | "ready" | "blocked" {
  const raw = option("--status") ?? "proposed";
  if (
    raw === "proposed" ||
    raw === "backlog" ||
    raw === "ready" ||
    raw === "blocked"
  )
    return raw;
  throw new Error(
    `Invalid --status ${raw}; expected proposed, backlog, ready, or blocked`,
  );
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
} else if (command === "frontier") {
  console.log(JSON.stringify(summarizeTaskTree(config).frontier, null, 2));
} else if (command === "promote-clear") {
  console.log(
    JSON.stringify(
      promoteClearProposedLeaves(config, numberOption("--limit", 10)),
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
        status: statusOption(),
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
} else {
  usage();
}
