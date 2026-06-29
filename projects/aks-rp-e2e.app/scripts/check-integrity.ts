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
  status?: string;
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
  accepts?: unknown;
  on?: unknown;
  emits?: unknown;
  intervalMs?: number;
  offsetMs?: number;
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
  emits?: Array<{
    type?: string;
    [key: string]: unknown;
  }>;
  event?: {
    type?: string;
    [key: string]: unknown;
  };
};

type EventSelector =
  | string
  | {
      type?: string;
      target?: {
        project?: string;
        taskId?: string;
      };
      project?: string;
      owner?: string;
      urgency?: string;
      actions?: string[];
      metricIds?: string[];
    };

type AppAction = {
  type?: string;
  event?: (params: unknown) => Record<string, unknown>;
};

type EventGraph = {
  externalEvents?: string[];
  intentionalCycles?: Array<{
    id?: string;
    events?: string[];
    reason?: string;
  }>;
  limits?: {
    maxHandlersPerEvent?: number;
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
  events?: EventSelector[];
  actions?: Record<string, AppAction>;
  eventGraph?: EventGraph;
};

type TaskNode = {
  id?: string;
  parent_id?: string | null;
  state?: string;
  status?: string;
  children?: string[];
  depends_on?: string[] | string;
  gates?: unknown;
  gate_status?: unknown;
  workflow?: string | null;
  context?: unknown;
};

type TaskTree = {
  project_lifecycle?: string;
  root_task_id?: string;
  tasks?: Record<string, TaskNode>;
  active_task_ids?: string[];
  active_task_id?: string | null;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const domainWorkflowNames = new Set(["spec-runner"]);
const errors: string[] = [];
const warnings: string[] = [];

const durableLoopContracts = [
  {
    name: "spec verification loop",
    stateRef: ".state/spec-loop/state.json",
    taskId: "aks-spec-verification-loop",
    workflow: "spec-loop-controller",
    collectionKey: "specs",
    required: true,
  },
  {
    name: "feature reference loop",
    stateRef: ".state/feature-reference-loop/state.json",
    taskId: "aks-feature-reference-loop",
    workflow: "feature-reference-loop-controller",
    collectionKey: "features",
    required: true,
  },
  {
    name: "feature compact loop",
    stateRef: ".state/feature-compact-loop/state.json",
    taskId: "aks-feature-compact-loop",
    workflow: "feature-compact-loop-controller",
    collectionKey: "features",
    required: true,
  },
] as const;

function taskState(task: TaskNode | undefined): string {
  const raw = task?.state ?? task?.status ?? "";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw;
}

function fail(message: string): void {
  errors.push(message);
}

function warn(message: string): void {
  warnings.push(message);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function readOptionalJson<T>(relativePath: string): T | null {
  const absolutePath = join(appDir, relativePath);
  if (!existsSync(absolutePath)) return null;
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
  if (domainPath && existsSync(join(domainPath, "tasks"))) {
    warn(
      "domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/",
    );
  }
  if (domainPath && existsSync(join(domainPath, "agents"))) {
    warn(
      "domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/",
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
    if (handler.intervalMs !== undefined || handler.offsetMs !== undefined) {
      fail(
        `workflow handler ${handler.name} must be event-only; put intervalMs/offsetMs on schedules instead`,
      );
    }

    const workflow = handler.handler?.workflow;
    if (!workflow)
      fail(`workflow handler ${handler.name} missing handler.workflow`);
    else if (!workflowNames.has(workflow))
      fail(
        `workflow handler ${handler.name} references missing workflows/${workflow}.ts`,
      );

    const inputs = workflowHandlerInputEvents(handler);
    if (!Array.isArray(handler.accepts) && !Array.isArray(handler.on))
      fail(`workflow handler ${handler.name} must declare accepts[]`);
    else if (handler.enabled !== false && inputs.length === 0)
      fail(`workflow handler ${handler.name} must be triggered by an event`);
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
    const events = scheduleEvents(schedule);
    if (events.length === 0)
      fail(`schedule ${schedule.id} must declare emits[]`);
    for (const event of events) {
      if (!event.type) fail(`schedule ${schedule.id} missing emits[].type`);
    }
  }
}

function eventTypeFromSelector(selector: EventSelector): string | null {
  if (typeof selector === "string") return selector;
  return typeof selector.type === "string" && selector.type.trim()
    ? selector.type.trim()
    : null;
}

function workflowHandlerSelectors(handler: WorkflowHandler): EventSelector[] {
  const raw = handler.accepts ?? handler.on;
  return Array.isArray(raw) ? (raw as EventSelector[]) : [];
}

function workflowHandlerInputEvents(handler: WorkflowHandler): string[] {
  return workflowHandlerSelectors(handler)
    .map(eventTypeFromSelector)
    .filter((event): event is string => Boolean(event));
}

function scheduleEvents(schedule: Schedule): Array<{ type?: string }> {
  return Array.isArray(schedule.emits)
    ? schedule.emits
    : schedule.event
      ? [schedule.event]
      : [];
}

function addMapValue(map: Map<string, string[]>, key: string, value: string) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function emittedActionEvents(projectApp: ProjectApp): Array<{
  action: string;
  event: string;
}> {
  const emitted: Array<{ action: string; event: string }> = [];
  for (const [actionName, action] of Object.entries(projectApp.actions ?? {})) {
    if (action.type !== "async" || typeof action.event !== "function") continue;
    try {
      const event = action.event({});
      if (typeof event?.type === "string") {
        emitted.push({ action: actionName, event: event.type });
      } else {
        fail(`async action ${actionName} did not return event.type`);
      }
    } catch (err) {
      fail(
        `async action ${actionName} failed while validating event graph: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return emitted;
}

function canonicalCycle(events: string[]): string {
  if (events.length === 0) return "";
  const rotations = events.map((_, index) => [
    ...events.slice(index),
    ...events.slice(0, index),
  ]);
  rotations.sort((a, b) => a.join("\u0000").localeCompare(b.join("\u0000")));
  return rotations[0].join(" -> ");
}

function findEventCycles(edges: Map<string, Set<string>>): string[][] {
  const cycles = new Map<string, string[]>();
  const nodes = [...edges.keys()].sort();

  function visit(start: string, current: string, path: string[]) {
    for (const next of edges.get(current) ?? []) {
      if (next === start) {
        const cycle = [...path, current];
        cycles.set(canonicalCycle(cycle), cycle);
        continue;
      }
      if (path.includes(next)) continue;
      visit(start, next, [...path, current]);
    }
  }

  for (const node of nodes) visit(node, node, []);
  return [...cycles.values()];
}

function cycleAllowed(cycle: string[], graph: EventGraph): boolean {
  const cycleSet = new Set(cycle);
  return (graph.intentionalCycles ?? []).some((intentional) => {
    const allowed = new Set(intentional.events ?? []);
    return (
      Boolean(intentional.id) &&
      Boolean(intentional.reason) &&
      cycle.every((event) => allowed.has(event)) &&
      [...allowed].some((event) => cycleSet.has(event))
    );
  });
}

function validateEventGraph(projectApp: ProjectApp): void {
  const graph = projectApp.eventGraph;
  if (!graph) {
    warn("app.ts missing eventGraph; event loop integrity cannot be audited");
    return;
  }

  const handlerConsumers = new Map<string, string[]>();
  for (const handler of projectApp.workflowHandlers ?? []) {
    if (handler.enabled === false) continue;
    for (const event of workflowHandlerInputEvents(handler)) {
      addMapValue(handlerConsumers, event, handler.name ?? "unnamed-handler");
    }
  }

  const maxDirectHandlers = graph.limits?.maxHandlersPerEvent ?? 1;
  for (const [event, handlers] of handlerConsumers) {
    if (handlers.length > maxDirectHandlers) {
      fail(
        `event ${event} has ${handlers.length} generated handlers (${handlers.join(", ")}); max is ${maxDirectHandlers}`,
      );
    }
  }

  for (const handler of projectApp.workflowHandlers ?? []) {
    if (handler.enabled === false || !handler.name) continue;
    if (!Array.isArray(handler.emits)) {
      fail(`generated handler ${handler.name} missing emits[]`);
      continue;
    }
    if (handler.emits.length === 0) {
      fail(`generated handler ${handler.name} must emit at least one event`);
    }
  }

  const consumed = new Set([
    ...handlerConsumers.keys(),
    ...(graph.externalEvents ?? []),
  ]);

  for (const selector of projectApp.events ?? []) {
    const event = eventTypeFromSelector(selector);
    if (!event) {
      fail("app.ts events entry missing event type");
      continue;
    }
    if (!handlerConsumers.has(event)) {
      fail(`app.ts custom event selector ${event} has no generated handler`);
    }
  }

  for (const schedule of projectApp.schedules ?? []) {
    for (const emitted of scheduleEvents(schedule)) {
      const event = emitted.type;
      if (!event) continue;
      if (!consumed.has(event)) {
        fail(
          `schedule ${schedule.id ?? "unnamed"} emits unhandled event ${event}`,
        );
      }
    }
  }

  for (const action of emittedActionEvents(projectApp)) {
    if (!consumed.has(action.event)) {
      fail(`action ${action.action} emits unhandled event ${action.event}`);
    }
  }

  const edges = new Map<string, Set<string>>();
  function edge(from: string, to: string) {
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from)!.add(to);
  }

  for (const handler of projectApp.workflowHandlers ?? []) {
    if (handler.enabled === false || !handler.name) continue;
    const emits = Array.isArray(handler.emits) ? handler.emits : [];
    for (const input of workflowHandlerInputEvents(handler)) {
      for (const output of emits) edge(input, output);
    }
  }

  for (const [from, outputs] of edges) {
    for (const output of outputs) {
      if (!consumed.has(output)) {
        fail(`eventGraph edge ${from} -> ${output} produces unhandled event`);
      }
    }
  }

  for (const cycle of findEventCycles(edges)) {
    if (!cycleAllowed(cycle, graph)) {
      fail(`eventGraph has undeclared event cycle: ${canonicalCycle(cycle)}`);
    }
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
  if (!tree.root_task_id) fail("tasks/tree.json missing root_task_id");
  else if (!tasks[tree.root_task_id])
    fail(`root_task_id ${tree.root_task_id} is missing from tasks`);

  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.id && task.id !== taskId)
      fail(`task key ${taskId} has mismatched id ${task.id}`);
    if ("status" in task)
      fail(`task ${taskId} uses legacy status field; use state`);
    const state = taskState(task);
    if (!["backlog", "active", "review", "done", "blocked"].includes(state))
      fail(`task ${taskId} has invalid state ${state || "(missing)"}`);
    for (const childId of task.children ?? []) {
      if (!taskIds.has(childId))
        fail(`task ${taskId} references missing child ${childId}`);
      else if (tasks[childId]?.parent_id !== taskId) {
        fail(
          `task ${taskId} lists child ${childId}, but child parent_id is ${tasks[childId]?.parent_id ?? "missing"}`,
        );
      }
    }
    if ("gates" in task)
      fail(
        `task ${taskId} uses legacy gates; use depends_on, forbidden, blocker, context, and conflict_scope`,
      );
    if ("gate_status" in task)
      fail(
        `task ${taskId} uses legacy gate_status; use depends_on, blocker, or context`,
      );
    const dependsOn = Array.isArray(task.depends_on)
      ? task.depends_on
      : typeof task.depends_on === "string"
        ? [task.depends_on]
        : [];
    for (const dependencyId of dependsOn) {
      if (!taskIds.has(dependencyId))
        fail(`task ${taskId} depends_on missing task ${dependencyId}`);
    }
    if (
      task.workflow &&
      !appWorkflowNames.has(task.workflow) &&
      !domainWorkflowNames.has(task.workflow)
    ) {
      fail(`task ${taskId} references unknown workflow ${task.workflow}`);
    }
  }

  for (const [taskId, task] of Object.entries(tasks)) {
    if (taskId === tree.root_task_id) {
      if (task.parent_id)
        fail(`root task ${taskId} must not have parent_id ${task.parent_id}`);
      continue;
    }
    if (!task.parent_id) {
      fail(`task ${taskId} is missing parent_id`);
      continue;
    }
    const parent = tasks[task.parent_id];
    if (!parent) {
      fail(`task ${taskId} has missing parent_id ${task.parent_id}`);
      continue;
    }
    if (!(parent.children ?? []).includes(taskId)) {
      fail(
        `task ${taskId} parent ${task.parent_id} does not include it in children[]`,
      );
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
  if (roots.length !== 1) {
    fail(
      `tasks/tree.json must have exactly one root, found ${roots
        .map((task) => task.id ?? "(missing)")
        .join(", ")}`,
    );
  } else if (roots[0].id !== tree.root_task_id) {
    fail(
      `tasks/tree.json root by children (${roots[0].id}) must match root_task_id ${tree.root_task_id}`,
    );
  }

  function isLeaf(task: TaskNode): boolean {
    return (task.children ?? []).length === 0;
  }

  function rolledUpParentState(task: TaskNode): string {
    const childStates = (task.children ?? [])
      .map((childId) => taskState(tasks[childId]))
      .filter(Boolean);
    if (childStates.length === 0) return taskState(task);
    if (childStates.includes("active")) return "active";
    if (childStates.includes("review")) return "review";
    if (childStates.includes("blocked")) return "blocked";
    if (childStates.includes("backlog")) return "backlog";
    return "done";
  }

  for (const [taskId, task] of Object.entries(tasks)) {
    if (isLeaf(task)) continue;
    const state = taskState(task);
    const rolledUp = rolledUpParentState(task);
    if (state !== rolledUp) {
      fail(
        `task ${taskId} state ${state} does not match child rollup ${rolledUp}`,
      );
    }
  }

  const activeLeaves = Object.values(tasks)
    .filter((task) => isLeaf(task) && taskState(task) === "active")
    .map((task) => task.id)
    .filter((id): id is string => Boolean(id))
    .sort();
  const configuredActiveLeaves = [...(tree.active_task_ids ?? [])].sort();
  if (JSON.stringify(configuredActiveLeaves) !== JSON.stringify(activeLeaves)) {
    fail(
      `active_task_ids (${configuredActiveLeaves.join(", ") || "none"}) must match active leaf tasks (${activeLeaves.join(", ") || "none"})`,
    );
  }
  const expectedActiveTaskId =
    (tree.active_task_ids ?? []).find(
      (id) => taskState(tasks[id]) === "active",
    ) ?? null;
  if ((tree.active_task_id ?? null) !== expectedActiveTaskId) {
    fail(
      `active_task_id (${tree.active_task_id ?? "none"}) must be ${expectedActiveTaskId ?? "none"}`,
    );
  }
  const hasOpenLeaf = Object.values(tasks).some(
    (task) => isLeaf(task) && taskState(task) !== "done",
  );
  const expectedLifecycle = hasOpenLeaf ? "active" : "closed";
  if (tree.project_lifecycle && tree.project_lifecycle !== expectedLifecycle) {
    fail(
      `project_lifecycle ${tree.project_lifecycle} must be ${expectedLifecycle} based on leaf task states`,
    );
  }
}

function loopStateCounts(
  state: Record<string, unknown>,
  collectionKey: string,
): Record<string, number> {
  const collection = record(state[collectionKey]);
  const counts: Record<string, number> = {};
  for (const item of Object.values(collection)) {
    const status =
      typeof record(item).status === "string"
        ? String(record(item).status)
        : "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function validateDurableLoopTasks(tree: TaskTree | null): void {
  if (!tree) return;
  const tasks = tree.tasks ?? {};

  for (const contract of durableLoopContracts) {
    const task = tasks[contract.taskId];
    if (contract.required && !task) {
      fail(
        `${contract.name} task ${contract.taskId} must remain in tasks/tree.json until the loop is explicitly retired`,
      );
    }
    if (task && task.workflow !== contract.workflow) {
      fail(
        `${contract.name} task ${contract.taskId} uses workflow ${task.workflow ?? "missing"}; expected ${contract.workflow}`,
      );
    }

    const state = readOptionalJson<Record<string, unknown>>(contract.stateRef);
    if (!state) continue;

    const stateLoopTaskId =
      typeof state.loopTaskId === "string" ? state.loopTaskId : "";
    if (stateLoopTaskId && stateLoopTaskId !== contract.taskId) {
      fail(
        `${contract.name} state ${contract.stateRef} has loopTaskId ${stateLoopTaskId}; expected ${contract.taskId}`,
      );
    }

    const counts = loopStateCounts(state, contract.collectionKey);
    const pending = counts.pending ?? 0;
    const running = counts.running ?? 0;
    const incomplete = pending + running;
    if (incomplete === 0) continue;

    if (!task) {
      fail(
        `${contract.name} has ${incomplete} pending/running item(s) in ${contract.stateRef}, but ${contract.taskId} is missing from tasks/tree.json`,
      );
      continue;
    }
    if (!["active", "backlog", "blocked", "review"].includes(taskState(task))) {
      fail(
        `${contract.name} task ${contract.taskId} is ${taskState(task)} while ${incomplete} item(s) remain pending/running`,
      );
    }

    const context = record(task.context);
    if (context.stateRef !== contract.stateRef) {
      fail(
        `${contract.name} task ${contract.taskId} context.stateRef must be ${contract.stateRef}`,
      );
    }
    const progress = record(context.workflowProgress);
    if (progress.completionReady === true) {
      fail(
        `${contract.name} task ${contract.taskId} marks workflowProgress.completionReady=true while ${pending} pending and ${running} running item(s) remain`,
      );
    }
  }
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
validateEventGraph(projectApp);
validateTaskTree(taskTree, workflowNames);
validateDurableLoopTasks(taskTree);

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
