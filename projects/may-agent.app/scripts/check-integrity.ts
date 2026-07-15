import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  normalizeTaskTreeInPlace,
  resolveTaskTreePath,
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

function eventSet(): Set<string> {
  const events = new Set<string>();
  for (const selector of app.events ?? []) {
    const type = eventType(selector);
    if (!type)
      addIssue("app.event.invalid", "App event selector is missing a type.");
    else events.add(type);
  }
  return events;
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

function checkManifest(): void {
  const events = eventSet();
  checkUnique("event", [...events]);

  const workflowHandlers = app.workflowHandlers ?? [];
  checkUnique(
    "workflowHandler",
    workflowHandlers.map((handler) => handler.name),
  );

  const workflowHandlerNames = new Set(
    workflowHandlers.map((handler) => handler.name),
  );
  const handlerEvents = new Set<string>();
  for (const handler of workflowHandlers) {
    if (!handler.enabled) continue;
    if (!handler.description?.trim()) {
      addIssue(
        "workflowHandler.description",
        `${handler.name} is missing a description.`,
      );
    }
    if (!handler.handler.workflow?.trim()) {
      addIssue(
        "workflowHandler.workflow",
        `${handler.name} is missing handler.workflow.`,
      );
    } else if (!pathExists(`workflows/${handler.handler.workflow}.ts`)) {
      addIssue(
        "workflowHandler.workflow.missing",
        `${handler.name} references missing workflow workflows/${handler.handler.workflow}.ts.`,
      );
    }
    if (!handler.handler.task?.trim()) {
      addIssue(
        "workflowHandler.task",
        `${handler.name} is missing handler.task.`,
      );
    }
    if (
      !Number.isFinite(handler.handler.timeoutMs) ||
      handler.handler.timeoutMs <= 0
    ) {
      addIssue(
        "workflowHandler.timeout",
        `${handler.name} has invalid timeoutMs.`,
      );
    }
    for (const selector of handler.accepts) {
      const type =
        typeof selector === "string" ? selector : selector.type;
      handlerEvents.add(type);
      if (!events.has(type)) {
        addIssue(
          "workflowHandler.event.undeclared",
          `${handler.name} listens to undeclared event ${type}.`,
        );
      }
    }
    for (const contextPath of handler.context ?? []) {
      if (!pathExists(contextPath)) {
        addIssue(
          "workflowHandler.context.missing",
          `${handler.name} context file is missing: ${contextPath}`,
        );
      }
    }
  }

  checkUnique(
    "schedule",
    (app.schedules ?? []).map((schedule) => schedule.id),
  );
  for (const schedule of app.schedules ?? []) {
    for (const event of schedule.emits) {
      const type = typeof event.type === "string" ? event.type : "";
      if (!type)
        addIssue(
          "schedule.emits.invalid",
          `${schedule.id} schedule event is missing type.`,
        );
      else if (!events.has(type)) {
        addIssue(
          "schedule.emits.undeclared",
          `${schedule.id} emits undeclared event ${type}.`,
        );
      }
    }
  }

  for (const [actionId, action] of Object.entries(app.actions ?? {})) {
    if (!action.description?.trim()) {
      addIssue("action.description", `${actionId} is missing a description.`);
    }
    if (action.type === "async") {
      const event = action.event({});
      const type = typeof event.type === "string" ? event.type : "";
      if (!type)
        addIssue(
          "action.event.invalid",
          `${actionId} async action event is missing type.`,
        );
      else if (!events.has(type))
        addIssue(
          "action.event.undeclared",
          `${actionId} emits undeclared event ${type}.`,
        );
    }
  }

  const graph = app.eventGraph;
  const externalEvents = new Set(graph?.externalEvents ?? []);
  const adapterEvents = new Set<string>();
  const emittedEvents = new Set<string>();

  for (const [handlerName, details] of Object.entries(graph?.handlers ?? {})) {
    if (!workflowHandlerNames.has(handlerName)) {
      addIssue(
        "eventGraph.handler.unknown",
        `eventGraph declares unknown handler ${handlerName}.`,
      );
    }
    for (const type of details.emits ?? []) emittedEvents.add(type);
  }

  for (const adapter of graph?.adapters ?? []) {
    adapterEvents.add(adapter.event);
    if (!events.has(adapter.event)) {
      addIssue(
        "eventGraph.adapter.undeclared",
        `Adapter references undeclared event ${adapter.event}.`,
      );
    }
    for (const type of adapter.emits ?? []) emittedEvents.add(type);
  }

  for (const type of emittedEvents) {
    if (!events.has(type) && !externalEvents.has(type)) {
      addIssue(
        "eventGraph.emit.unhandled",
        `eventGraph emits ${type}, but it is neither declared nor external.`,
      );
    }
  }

  for (const type of events) {
    const hasRoute =
      handlerEvents.has(type) ||
      adapterEvents.has(type) ||
      externalEvents.has(type);
    if (!hasRoute) {
      addIssue(
        "event.unrouted",
        `Declared event ${type} has no handler, adapter, or external classification.`,
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
