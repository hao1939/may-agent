import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  normalizeTaskTreeInPlace,
  resolveTaskTreePath,
  type EventSelector,
  type ProjectApp,
  type TaskTree,
} from "@may-agent/sdk";
import app from "../app";

type Issue = {
  code: string;
  message: string;
};

const appDir = resolve(dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = resolve(appDir, "../..");
const allowedTaskStates = new Set([
  "backlog",
  "active",
  "review",
  "blocked",
  "done",
]);

const issues: Issue[] = [];

function addIssue(code: string, message: string): void {
  issues.push({ code, message });
}

function eventType(selector: unknown): string {
  if (typeof selector === "string") return selector;
  if (selector && typeof selector === "object" && !Array.isArray(selector)) {
    const type = (selector as { type?: unknown }).type;
    return typeof type === "string" ? type : "";
  }
  return "";
}

function pathExists(path: string): boolean {
  if (existsSync(resolve(appDir, path))) return true;
  if (existsSync(resolve(repoRoot, path))) return true;
  return existsSync(path);
}

function checkUnique(name: string, values: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value))
      addIssue(`${name}.duplicate`, `Duplicate ${name}: ${value}`);
    seen.add(value);
  }
}

function checkTaskCapability(
  label: string,
  capability: {
    workflow?: string;
    task?: string;
    timeoutMs?: number;
    context?: string[];
  },
): void {
  if (!capability.workflow?.trim()) {
    addIssue("taskCapability.workflow", `${label} is missing workflow.`);
  } else if (!pathExists(`workflows/${capability.workflow}.ts`)) {
    addIssue(
      "taskCapability.workflow.missing",
      `${label} references missing workflow workflows/${capability.workflow}.ts.`,
    );
  }
  if (!capability.task?.trim()) {
    addIssue("taskCapability.task", `${label} is missing task.`);
  }
  if (
    !Number.isFinite(capability.timeoutMs) ||
    (capability.timeoutMs ?? 0) <= 0
  ) {
    addIssue("taskCapability.timeout", `${label} has invalid timeoutMs.`);
  }
  for (const contextPath of capability.context ?? []) {
    if (!pathExists(contextPath)) {
      addIssue(
        "taskCapability.context.missing",
        `${label} context file is missing: ${contextPath}`,
      );
    }
  }
}

function checkManifest(): void {
  const onEventTypes = new Set<string>();
  for (const selector of app.events ?? []) {
    const type = eventType(selector);
    if (!type) {
      addIssue("app.event.invalid", "App event selector is missing a type.");
    } else {
      onEventTypes.add(type);
    }
  }
  if (onEventTypes.size > 0 && typeof app.onEvent !== "function") {
    addIssue("app.onEvent.missing", "App declares events without onEvent().");
  }

  const routedEvents = new Set<string>();
  const taskRoutes = app.taskRoutes ?? [];
  checkUnique(
    "taskRoute",
    taskRoutes.map((route) => route.name),
  );
  const taskRouteNames = new Set(taskRoutes.map((route) => route.name));
  if (taskRoutes.length > 0 && !app.ownerEntry) {
    addIssue(
      "taskRoute.ownerEntry.missing",
      "App declares taskRoutes without an ownerEntry fallback.",
    );
  }
  if (app.ownerEntry) checkTaskCapability("ownerEntry", app.ownerEntry);
  for (const [name, capability] of Object.entries(app.taskWorkflows ?? {})) {
    checkTaskCapability(`taskWorkflows.${name}`, capability);
  }
  for (const route of taskRoutes) {
    if (!route.enabled) continue;
    if (!route.description?.trim()) {
      addIssue(
        "taskRoute.description",
        `${route.name} is missing a description.`,
      );
    }
    if (typeof route.resolve !== "function") {
      addIssue("taskRoute.resolve", `${route.name} is missing resolve().`);
    }
    if (
      route.maxConcurrentTriggers !== undefined &&
      (!Number.isInteger(route.maxConcurrentTriggers) ||
        route.maxConcurrentTriggers <= 0)
    ) {
      addIssue(
        "taskRoute.concurrency",
        `${route.name} has invalid maxConcurrentTriggers.`,
      );
    }
    for (const selector of route.accepts as readonly EventSelector[]) {
      const type = eventType(selector);
      if (!type) {
        addIssue(
          "taskRoute.event.invalid",
          `${route.name} has an event selector without a type.`,
        );
      } else {
        routedEvents.add(type);
      }
    }
  }

  const emittedEvents = new Set<string>();
  checkUnique(
    "schedule",
    (app.schedules ?? []).map((schedule) => schedule.id),
  );
  for (const schedule of app.schedules ?? []) {
    for (const event of schedule.emits) {
      const type = eventType(event);
      if (!type) {
        addIssue(
          "schedule.emits.invalid",
          `${schedule.id} schedule event is missing type.`,
        );
      } else {
        emittedEvents.add(type);
      }
    }
  }

  for (const [actionId, action] of Object.entries(app.actions ?? {})) {
    if (!action.description?.trim()) {
      addIssue("action.description", `${actionId} is missing a description.`);
    }
    if (action.type === "async") {
      const event = action.event({});
      const type = eventType(event);
      if (!type) {
        addIssue(
          "action.event.invalid",
          `${actionId} async action event is missing type.`,
        );
      } else {
        emittedEvents.add(type);
      }
    }
  }

  const graph = app.eventGraph;
  const externalEvents = new Set(graph?.externalEvents ?? []);
  const declaredOnEventTypes = new Set<string>();
  for (const [routeName, details] of Object.entries(graph?.routes ?? {})) {
    if (!taskRouteNames.has(routeName)) {
      addIssue(
        "eventGraph.route.unknown",
        `eventGraph declares unknown task route ${routeName}.`,
      );
    }
    for (const type of details.emits ?? []) emittedEvents.add(type);
  }

  for (const adapter of graph?.adapters ?? []) {
    declaredOnEventTypes.add(adapter.event);
    for (const type of adapter.emits ?? []) emittedEvents.add(type);
  }
  for (const type of onEventTypes) {
    if (!declaredOnEventTypes.has(type)) {
      addIssue(
        "eventGraph.adapter.missing",
        `onEvent accepts ${type}, but eventGraph has no adapter declaration.`,
      );
    }
  }
  for (const type of declaredOnEventTypes) {
    if (!onEventTypes.has(type)) {
      addIssue(
        "eventGraph.adapter.unrouted",
        `eventGraph declares adapter ${type}, but events does not route it to onEvent.`,
      );
    }
  }

  const consumedEvents = new Set([
    ...routedEvents,
    ...onEventTypes,
    ...externalEvents,
  ]);
  for (const type of emittedEvents) {
    if (!consumedEvents.has(type)) {
      addIssue(
        "eventGraph.emit.unhandled",
        `App emits ${type}, but no task route, adapter, or external boundary accepts it.`,
      );
    }
  }
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
  if (typeof value === "string" && value) return [value];
  return [];
}

function checkTaskTree(): void {
  const treePath = resolveTaskTreePath(appDir);
  if (!existsSync(treePath)) {
    addIssue("taskTree.missing", "task tree is missing.");
    return;
  }

  const tree = normalizeTaskTreeInPlace(
    JSON.parse(readFileSync(treePath, "utf8")) as TaskTree,
  );
  const tasks = tree.tasks ?? {};
  const rootId = tree.root_task_id;
  if (!rootId || !tasks[rootId]) {
    addIssue(
      "taskTree.root",
      `root_task_id ${rootId ?? "<missing>"} does not exist in tasks.`,
    );
  }

  for (const [id, task] of Object.entries(tasks)) {
    if (task.id !== id)
      addIssue(
        "task.id",
        `Task key ${id} has mismatched id ${task.id ?? "<missing>"}.`,
      );
    const state = task.state ?? task.status ?? "backlog";
    if (!allowedTaskStates.has(state))
      addIssue("task.state", `Task ${id} has invalid state ${state}.`);
    if (id !== rootId) {
      const parentId = task.parent_id;
      if (!parentId || !tasks[parentId])
        addIssue(
          "task.parent",
          `Task ${id} has missing parent ${parentId ?? ""}.`,
        );
      else if (!asStringArray(tasks[parentId].children).includes(id)) {
        addIssue(
          "task.parent.link",
          `Task ${id} parent ${parentId} does not list it as a child.`,
        );
      }
    }
    for (const childId of asStringArray(task.children)) {
      const child = tasks[childId];
      if (!child)
        addIssue(
          "task.child.missing",
          `Task ${id} references missing child ${childId}.`,
        );
      else if (child.parent_id !== id) {
        addIssue(
          "task.child.parent",
          `Task ${id} child ${childId} has parent ${child.parent_id ?? "<missing>"}.`,
        );
      }
    }
    for (const dependencyId of asStringArray(task.depends_on)) {
      if (!tasks[dependencyId])
        addIssue(
          "task.dependency.missing",
          `Task ${id} depends on missing task ${dependencyId}.`,
        );
    }
  }

  for (const activeId of asStringArray(tree.active_task_ids)) {
    if (!tasks[activeId])
      addIssue(
        "taskTree.active.missing",
        `active_task_ids references missing task ${activeId}.`,
      );
  }
  if (tree.active_task_id && !tasks[tree.active_task_id]) {
    addIssue(
      "taskTree.active.missing",
      `active_task_id references missing task ${tree.active_task_id}.`,
    );
  }
}

checkManifest();
checkTaskTree();

if (issues.length > 0) {
  console.error(`App integrity check failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`- [${issue.code}] ${issue.message}`);
  }
  process.exit(1);
}

console.log("App integrity check passed.");
