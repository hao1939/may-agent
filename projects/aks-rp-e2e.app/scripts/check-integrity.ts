import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import app from "../app.ts";

type AgentConfig = {
  name?: string;
  disabled?: boolean;
};

type ProjectJson = {
  id?: string;
  owner?: string;
  type?: string;
  domainProject?: {
    id?: string;
    path?: string;
    repo?: string;
    branch?: string;
  };
};

type WorkflowHandler = {
  name?: string;
  enabled?: boolean;
  on?: unknown;
  handler?: {
    workflow?: string;
    agent?: string;
    projectId?: string;
    task?: string;
    timeoutMs?: number;
  };
};

type Schedule = {
  id?: string;
  enabled?: boolean;
  intervalMs?: number;
  event?: {
    type?: string;
    [key: string]: unknown;
  };
};

type ProjectApp = {
  id?: string;
  workspace?: {
    kind?: string;
    repo?: string;
    localPath?: string;
    branch?: string;
  };
  workflowHandlers?: WorkflowHandler[];
  schedules?: Schedule[];
};

type TaskNode = {
  id?: string;
  status?: string;
  children?: string[];
  workflow?: string | null;
};

type TaskTree = {
  tasks?: Record<string, TaskNode>;
  active_task_ids?: string[];
  active_task_id?: string | null;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const domainWorkflowNames = new Set(["spec-runner"]);
const errors: string[] = [];
const warnings: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

function warn(message: string): void {
  warnings.push(message);
}

function readJson<T>(relativePath: string): T | null {
  const absolutePath = join(appDir, relativePath);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf-8")) as T;
  } catch (err) {
    fail(
      `${relativePath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

function listWorkflowNames(): Set<string> {
  const workflowDir = join(appDir, "workflows");
  if (!existsSync(workflowDir)) {
    fail("workflows/ does not exist");
    return new Set();
  }
  return new Set(
    readdirSync(workflowDir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => name.slice(0, -".ts".length)),
  );
}

function configuredAgentName(dirName: string): string | null {
  const agentJsonPath = join(appDir, "agents", dirName, "agent.json");
  if (!existsSync(agentJsonPath)) return dirName;
  try {
    const config = JSON.parse(
      readFileSync(agentJsonPath, "utf-8"),
    ) as AgentConfig;
    if (config.disabled) return null;
    return typeof config.name === "string" && config.name.trim()
      ? config.name.trim()
      : dirName;
  } catch (err) {
    fail(
      `agents/${dirName}/agent.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

function inferOwner(): string | null {
  const agentsRoot = join(appDir, "agents");
  if (!existsSync(agentsRoot)) {
    fail("agents/ does not exist; app owner cannot be inferred");
    return null;
  }
  const agents = readdirSync(agentsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !entry.name.startsWith("_"),
    )
    .map((entry) => ({
      dirName: entry.name,
      name: configuredAgentName(entry.name),
    }))
    .filter((entry): entry is { dirName: string; name: string } =>
      Boolean(entry.name),
    );

  if (agents.length === 1) return agents[0].name;
  const owner =
    agents.find((entry) => entry.dirName === "owner") ??
    agents.find((entry) => entry.dirName === "project-owner");
  if (owner) return owner.name;
  fail(
    `agents/ has ${agents.length} active agents and no agents/owner or agents/project-owner convention`,
  );
  return null;
}

function validatePackageJson(): void {
  const packageJson = readJson<{ scripts?: Record<string, string> }>(
    "package.json",
  );
  if (!packageJson) return;
  for (const scriptName of [
    "bundle",
    "check",
    "integrity",
    "syntax",
    "typecheck",
    "test",
    "format",
    "format:check",
  ]) {
    if (typeof packageJson.scripts?.[scriptName] !== "string") {
      fail(`package.json missing script "${scriptName}"`);
    }
  }
}

function validateProjectAndApp(
  projectJson: ProjectJson | null,
  projectApp: ProjectApp,
  owner: string | null,
): void {
  if (!projectApp.id) fail("app.ts default export missing id");
  if (!projectApp.workspace?.localPath)
    fail("app.ts workspace.localPath is required");
  if (!projectApp.workspace?.repo) fail("app.ts workspace.repo is required");
  if (!projectApp.workspace?.branch)
    fail("app.ts workspace.branch is required");

  if (!projectJson) return;
  if (projectJson.type !== "project-app")
    fail('project.json type must be "project-app"');
  if (projectJson.domainProject?.id !== projectApp.id) {
    fail(
      `project.json domainProject.id (${projectJson.domainProject?.id ?? "missing"}) must match app id (${projectApp.id ?? "missing"})`,
    );
  }
  if (
    projectJson.domainProject?.path &&
    projectApp.workspace?.localPath &&
    projectJson.domainProject.path !== projectApp.workspace.localPath
  ) {
    fail(
      `project.json domainProject.path (${projectJson.domainProject.path}) must match app.ts workspace.localPath (${projectApp.workspace.localPath})`,
    );
  }
  if (projectJson.owner && owner && projectJson.owner !== owner) {
    fail(
      `project.json owner (${projectJson.owner}) must match inferred owner (${owner})`,
    );
  }

  const domainPath = projectApp.workspace?.localPath
    ? resolve(appDir, projectApp.workspace.localPath)
    : "";
  if (domainPath && !existsSync(domainPath))
    fail(`domain workspace does not exist: ${domainPath}`);
  if (domainPath && !existsSync(join(domainPath, "runner", "spec-runner.ts"))) {
    fail(
      "domain workspace missing runner/spec-runner.ts required by spec-runner tasks",
    );
  }
}

function validateWorkflowHandlers(
  projectApp: ProjectApp,
  workflowNames: Set<string>,
): void {
  const seen = new Set<string>();
  for (const handler of projectApp.workflowHandlers ?? []) {
    if (!handler.name) {
      fail("workflowHandlers entry missing name");
      continue;
    }
    if (seen.has(handler.name))
      fail(`duplicate workflow handler name: ${handler.name}`);
    seen.add(handler.name);

    const workflow = handler.handler?.workflow;
    if (!workflow)
      fail(`workflow handler ${handler.name} missing handler.workflow`);
    else if (!workflowNames.has(workflow))
      fail(
        `workflow handler ${handler.name} references missing workflows/${workflow}.ts`,
      );

    if (!Array.isArray(handler.on))
      fail(`workflow handler ${handler.name} must declare on[]`);
    if (!handler.handler?.task)
      fail(`workflow handler ${handler.name} missing handler.task`);
    if (
      handler.handler?.timeoutMs !== undefined &&
      handler.handler.timeoutMs < 10_000
    ) {
      fail(`workflow handler ${handler.name} timeoutMs is too low`);
    }
  }
}

function validateSchedules(projectApp: ProjectApp): void {
  const seen = new Set<string>();
  for (const schedule of projectApp.schedules ?? []) {
    if (!schedule.id) {
      fail("schedule missing id");
      continue;
    }
    if (seen.has(schedule.id)) fail(`duplicate schedule id: ${schedule.id}`);
    seen.add(schedule.id);
    if (schedule.enabled !== false && !schedule.intervalMs)
      fail(`enabled schedule ${schedule.id} missing intervalMs`);
    if (schedule.intervalMs !== undefined && schedule.intervalMs < 10_000)
      fail(`schedule ${schedule.id} intervalMs is too low`);
    if (!schedule.event?.type)
      fail(`schedule ${schedule.id} missing event.type`);
  }
}

function validateTaskTree(
  tree: TaskTree | null,
  appWorkflowNames: Set<string>,
): void {
  if (!tree) return;
  const tasks = tree.tasks ?? {};
  const taskIds = new Set(Object.keys(tasks));
  if (taskIds.size === 0) fail("tasks/tree.json has no tasks");

  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.id && task.id !== taskId)
      fail(`task key ${taskId} has mismatched id ${task.id}`);
    for (const childId of task.children ?? []) {
      if (!taskIds.has(childId))
        fail(`task ${taskId} references missing child ${childId}`);
    }
    if (
      task.workflow &&
      !appWorkflowNames.has(task.workflow) &&
      !domainWorkflowNames.has(task.workflow)
    ) {
      fail(`task ${taskId} references unknown workflow ${task.workflow}`);
    }
  }

  for (const activeId of tree.active_task_ids ?? []) {
    if (!taskIds.has(activeId))
      fail(`active_task_ids references missing task ${activeId}`);
  }
  if (tree.active_task_id && !taskIds.has(tree.active_task_id)) {
    fail(`active_task_id references missing task ${tree.active_task_id}`);
  }

  const roots = Object.values(tasks).filter((task) => {
    const id = task.id;
    if (!id) return false;
    return !Object.values(tasks).some((candidate) =>
      (candidate.children ?? []).includes(id),
    );
  });
  if (roots.length === 0) fail("tasks/tree.json has no root task");
  if (roots.length > 3)
    warn(
      `tasks/tree.json has ${roots.length} roots; review whether the tree is still human-readable`,
    );
}

validatePackageJson();
const projectApp = app as ProjectApp;
const projectJson = readJson<ProjectJson>("project.json");
const taskTree = readJson<TaskTree>("tasks/tree.json");
const owner = inferOwner();
const workflowNames = listWorkflowNames();

validateProjectAndApp(projectJson, projectApp, owner);
validateWorkflowHandlers(projectApp, workflowNames);
validateSchedules(projectApp);
validateTaskTree(taskTree, workflowNames);

for (const message of warnings) {
  console.warn(`[warn] ${message}`);
}

if (errors.length > 0) {
  console.error(`App integrity check failed with ${errors.length} issue(s):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `App integrity OK: ${projectApp.id} owner=${owner} workflows=${workflowNames.size} tasks=${Object.keys(taskTree?.tasks ?? {}).length}`,
);
