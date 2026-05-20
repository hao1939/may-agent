export const PROJECT_TASK_STATUSES = ["pending", "ready", "running", "done"] as const;
export const PROJECT_TASK_RESULTS = ["succeeded", "failed", "dropped", "superseded"] as const;

export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
export type ProjectTaskResult = (typeof PROJECT_TASK_RESULTS)[number];

export interface ProjectTask {
  id: string;
  status: ProjectTaskStatus | string;
  result: ProjectTaskResult | string | null;
  assignee: string;
  goal: string;
  run: string | null;
  depends_on: string[];
  attempts: number;
}

export interface ProjectTaskParseResult {
  tasks: ProjectTask[];
  errors: string[];
}

export interface PlannedProjectTask extends ProjectTask {
  status: ProjectTaskStatus;
  unmetDependencies: string[];
}

export interface ProjectTaskPlan {
  tasks: PlannedProjectTask[];
  dispatchable: PlannedProjectTask[];
  running: PlannedProjectTask[];
  done: PlannedProjectTask[];
  pending: PlannedProjectTask[];
  capacity: number;
  allDone: boolean;
  needsOwnerJudgment: boolean;
  errors: string[];
}

export interface ProjectTaskPlanOptions {
  maxConcurrent?: number;
  activeTaskIds?: Iterable<string>;
}

export type ProjectTaskFieldPatch = Partial<{
  status: ProjectTaskStatus;
  result: ProjectTaskResult | null;
  assignee: string;
  goal: string;
  run: string | null;
  depends_on: string[];
  attempts: number;
}>;

const STATUS_SET = new Set<string>(PROJECT_TASK_STATUSES);
const RESULT_SET = new Set<string>(PROJECT_TASK_RESULTS);

function stripInlineComment(value: string): string {
  return value.replace(/\s+#.*$/, "").trim();
}

function unquote(value: string): string {
  const trimmed = stripInlineComment(value);
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function parseList(value: string): string[] {
  const raw = stripInlineComment(value);
  if (!raw || raw === "[]") return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => unquote(item).trim()).filter(Boolean);
  }
  return [unquote(raw)].filter(Boolean);
}

function parseResult(value: string | undefined): string | null {
  if (value === undefined) return null;
  const parsed = unquote(value);
  if (!parsed || parsed === "null") return null;
  return parsed;
}

function parseAttempts(value: string | undefined): number {
  const parsed = Number.parseInt(unquote(value ?? "0"), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function extractTasksSection(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Tasks\s*$/i.test(line.trim()));
  if (start < 0) return null;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}

function emptyTask(fields: Record<string, string>): ProjectTask {
  return {
    id: unquote(fields.id ?? ""),
    status: unquote(fields.status ?? "pending") || "pending",
    result: parseResult(fields.result),
    assignee: unquote(fields.assignee ?? ""),
    goal: unquote(fields.goal ?? ""),
    run: parseResult(fields.run),
    depends_on: parseList(fields.depends_on ?? "[]"),
    attempts: parseAttempts(fields.attempts),
  };
}

export function parseProjectTasks(content: string): ProjectTaskParseResult {
  const section = extractTasksSection(content);
  if (section === null) return { tasks: [], errors: [] };

  const tasks: ProjectTask[] = [];
  const errors: string[] = [];
  let fields: Record<string, string> | null = null;

  function flush(): void {
    if (!fields) return;
    const task = emptyTask(fields);
    if (!task.id) errors.push("task is missing id");
    tasks.push(task);
    fields = null;
  }

  for (const rawLine of section.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;

    const first = rawLine.match(/^-\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (first) {
      flush();
      fields = { [first[1]]: first[2] };
      continue;
    }

    const field = rawLine.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field && fields) {
      fields[field[1]] = field[2];
      continue;
    }

    errors.push(`unrecognized task line: ${rawLine.trim()}`);
  }
  flush();

  return { tasks, errors: [...errors, ...validateProjectTasks(tasks)] };
}

export function validateProjectTasks(tasks: ProjectTask[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const task of tasks) {
    const label = task.id || "(missing id)";
    if (!task.id) errors.push("task is missing id");
    else if (seen.has(task.id)) errors.push(`duplicate task id '${task.id}'`);
    else seen.add(task.id);

    if (!task.assignee) errors.push(`task ${label} is missing assignee`);
    if (!task.goal) errors.push(`task ${label} is missing goal`);
    if (!STATUS_SET.has(task.status)) errors.push(`task ${label} has non-canonical status '${task.status}'`);
    if (task.result !== null && !RESULT_SET.has(task.result)) errors.push(`task ${label} has non-canonical result '${task.result}'`);
    if (task.run !== null && task.run !== "agent" && !/^workflow:[A-Za-z0-9_.-]+$/.test(task.run)) {
      errors.push(`task ${label} has non-canonical run '${task.run}'`);
    }
    if ((task.status === "done") !== (task.result !== null)) {
      errors.push(`task ${label} is done only when status is 'done' and result is set`);
    }
    for (const dep of task.depends_on) {
      if (!dep) errors.push(`task ${label} has an empty dependency id`);
    }
  }

  return errors;
}

function dependencySucceeded(task: ProjectTask | undefined): boolean {
  return task?.status === "done" && task.result === "succeeded";
}

export function planProjectTasks(tasks: ProjectTask[], opts: ProjectTaskPlanOptions = {}): ProjectTaskPlan {
  const maxConcurrent = Math.max(0, Math.floor(opts.maxConcurrent ?? 3));
  const activeTaskIds = new Set(opts.activeTaskIds ?? []);
  const byId = new Map(tasks.map((task) => [task.id, task]));

  const planned = tasks.map((task): PlannedProjectTask => {
    if (task.status === "done") {
      return { ...task, status: "done", unmetDependencies: [] };
    }

    const unmetDependencies = task.depends_on.filter((dep) => !dependencySucceeded(byId.get(dep)));
    if (unmetDependencies.length > 0) {
      return { ...task, status: "pending", unmetDependencies };
    }

    if (activeTaskIds.has(task.id)) {
      return { ...task, status: "running", unmetDependencies: [] };
    }

    return { ...task, status: "ready", unmetDependencies: [] };
  });

  const running = planned.filter((task) => task.status === "running");
  const capacity = Math.max(0, maxConcurrent - running.length);
  const dispatchable = planned.filter((task) => task.status === "ready").slice(0, capacity);
  const done = planned.filter((task) => task.status === "done");
  const pending = planned.filter((task) => task.status === "pending");
  const allDone = planned.length > 0 && done.length === planned.length;

  return {
    tasks: planned,
    dispatchable,
    running,
    done,
    pending,
    capacity,
    allDone,
    needsOwnerJudgment: allDone,
    errors: validateProjectTasks(tasks),
  };
}

function formatFieldValue(value: string | number | string[] | null): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (/[\n\r\t"\\]/.test(value) || /^\s|\s$/.test(value) || /:\s/.test(value) || value === "") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
  }
  return value;
}

function taskIdFromLine(line: string): string | null {
  const match = line.match(/^-\s+id:\s*(.*)$/);
  return match ? unquote(match[1]) : null;
}

export function updateProjectTaskFields(content: string, taskId: string, patch: ProjectTaskFieldPatch): string {
  const lines = content.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => /^##\s+Tasks\s*$/i.test(line.trim()));
  if (sectionStart < 0) return content;

  let start = -1;
  let end = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) {
      end = i;
      break;
    }
    const id = taskIdFromLine(lines[i]);
    if (id === taskId) {
      start = i;
      end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^-\s+id:\s*/.test(lines[j]) || /^##\s+\S/.test(lines[j])) {
          end = j;
          break;
        }
      }
      break;
    }
  }
  if (start < 0) return content;

  const entries = Object.entries(patch) as Array<[keyof ProjectTaskFieldPatch, string | number | string[] | null | undefined]>;
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    const formatted = `  ${key}: ${formatFieldValue(value)}`;
    let replaced = false;
    for (let i = start + 1; i < end; i++) {
      if (new RegExp(`^\\s+${key}:`).test(lines[i])) {
        lines[i] = formatted;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      lines.splice(start + 1, 0, formatted);
      end++;
    }
  }

  return lines.join("\n");
}
