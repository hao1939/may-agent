import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  createPublicTaskEvidenceProvider,
  type PublicCommand,
} from "./lib/public-task-evidence.js";
import {
  configuredTaskReportRoot,
  listTaskReports,
} from "./lib/task-report-store.js";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "task-outcome-selector";
export const description =
  "Select at most one fair external Task candidate through public App reads.";

type Input = { reason?: string };
type SelectorConfig = {
  enabled: boolean;
  intervalMs: number;
  maxApps: number;
  maxTasksPerApp: number;
};

type Candidate = { appId: string; taskId: string };
type SelectorState = {
  appId: string;
  appIndex: number;
  taskCursor: string;
  taskOffset: number;
};
type Selection = { candidate: Candidate | null; state: SelectorState };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function canonical(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/\.app$/, "");
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function bounded(value: unknown, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(maximum, Math.trunc(parsed)))
    : fallback;
}

export function automaticReviewConfig(
  env: NodeJS.ProcessEnv = process.env,
): SelectorConfig {
  return {
    enabled: text(env.EVALUATION_AUTO_REVIEW_ENABLED).toLowerCase() === "true",
    intervalMs: bounded(
      env.EVALUATION_AUTO_REVIEW_INTERVAL_MS,
      86_400_000,
      604_800_000,
    ),
    maxApps: bounded(env.EVALUATION_AUTO_REVIEW_MAX_APPS, 20, 100),
    maxTasksPerApp: bounded(
      env.EVALUATION_AUTO_REVIEW_MAX_TASKS_PER_APP,
      20,
      100,
    ),
  };
}

function taskId(task: Record<string, unknown>): string {
  return text(task.id ?? task.taskId);
}
function isReviewable(task: Record<string, unknown>): boolean {
  const status = text(task.status).toLowerCase();
  return (
    Boolean(taskId(task)) && !["pending", "running", "waiting"].includes(status)
  );
}
function cleanState(value: unknown): SelectorState {
  const item = object(value);
  return {
    appId: text(item.appId).slice(0, 124),
    appIndex: Math.max(0, Math.trunc(Number(item.appIndex) || 0)),
    taskCursor: text(item.taskCursor).slice(0, 512),
    taskOffset: Math.max(0, Math.trunc(Number(item.taskOffset) || 0)),
  };
}
function stateFact(state: SelectorState): string {
  return `selector-state:${Buffer.from(JSON.stringify(state)).toString("base64url")}`;
}
function stateFromFacts(facts: string[]): SelectorState {
  const encoded = facts.find((fact) => fact.startsWith("selector-state:"));
  if (!encoded) return cleanState(null);
  try {
    return cleanState(
      JSON.parse(Buffer.from(encoded.slice(15), "base64url").toString("utf8")),
    );
  } catch {
    return cleanState(null);
  }
}

async function acceptedSelectorState(
  ctx: WorkflowContext<Input>,
): Promise<SelectorState> {
  const taskId = ctx.reconciliation?.taskId;
  if (!taskId) return cleanState(null);
  try {
    const response = object(await ctx.read.tasks.get(taskId));
    const task = Object.keys(object(response.task)).length
      ? object(response.task)
      : response;
    return stateFromFacts(strings(task.facts ?? object(task.result).facts));
  } catch {
    return cleanState(null);
  }
}

export async function selectFairCandidate(
  command?: PublicCommand,
  config = automaticReviewConfig(),
  reportRoot = configuredTaskReportRoot(),
  priorState: SelectorState = cleanState(null),
): Promise<Selection> {
  if (!config.enabled) return { candidate: null, state: priorState };
  const provider = createPublicTaskEvidenceProvider(command);
  const reports = listTaskReports(reportRoot, 100);
  const lastByApp = new Map<string, number>();
  const reviewed = new Set<string>();
  for (const report of reports) {
    const key = canonical(report.appId);
    lastByApp.set(key, Math.max(lastByApp.get(key) ?? 0, report.createdAt));
    reviewed.add(`${key}\u0000${report.taskId}`);
  }
  const apps = (await provider.listApps(config.maxApps))
    .map((app) => text(app.id ?? app.appId))
    .filter((id) => id && canonical(id) !== "evaluation")
    .sort(
      (a, b) =>
        (lastByApp.get(canonical(a)) ?? 0) -
          (lastByApp.get(canonical(b)) ?? 0) || a.localeCompare(b),
    );
  if (!apps.length) return { candidate: null, state: cleanState(null) };

  const rememberedIndex = apps.findIndex(
    (appId) => canonical(appId) === canonical(priorState.appId),
  );
  const start =
    rememberedIndex >= 0 ? rememberedIndex : priorState.appIndex % apps.length;
  let nextState = priorState;
  for (let offset = 0; offset < apps.length; offset += 1) {
    const appIndex = (start + offset) % apps.length;
    const appId = apps[appIndex]!;
    const sameRememberedApp = canonical(appId) === canonical(priorState.appId);
    const page = await provider.listTaskPage(
      appId,
      config.maxTasksPerApp,
      sameRememberedApp ? priorState.taskCursor : "",
    );
    const tasks = page.items.map(object).filter(isReviewable);
    const startOffset = sameRememberedApp
      ? priorState.taskOffset % Math.max(1, tasks.length)
      : 0;
    const rotated = tasks.map(
      (_, index) => tasks[(startOffset + index) % tasks.length]!,
    );
    const selected =
      rotated.find(
        (task) => !reviewed.has(`${canonical(appId)}\u0000${taskId(task)}`),
      ) ?? rotated[0];
    if (selected) {
      const selectedIndex = tasks.indexOf(selected);
      const pageExhausted = selectedIndex + 1 >= tasks.length;
      const nextIndex =
        pageExhausted && !page.nextCursor
          ? (appIndex + 1) % apps.length
          : appIndex;
      return {
        candidate: { appId, taskId: taskId(selected) },
        state: {
          appId: apps[nextIndex]!,
          appIndex: nextIndex,
          taskCursor:
            pageExhausted && page.nextCursor
              ? page.nextCursor.slice(0, 512)
              : sameRememberedApp
                ? priorState.taskCursor
                : "",
          taskOffset: pageExhausted ? 0 : selectedIndex + 1,
        },
      };
    }
    const nextIndex = page.nextCursor ? appIndex : (appIndex + 1) % apps.length;
    nextState = {
      appId: apps[nextIndex]!,
      appIndex: nextIndex,
      taskCursor: page.nextCursor.slice(0, 512),
      taskOffset: 0,
    };
  }
  return { candidate: null, state: nextState };
}

export async function runTaskOutcomeSelector(
  ctx: WorkflowContext<Input>,
  command?: PublicCommand,
  config = automaticReviewConfig(),
  reportRoot = configuredTaskReportRoot(),
): Promise<ExecutionResult> {
  if (!config.enabled) {
    const summary = "Automatic task-outcome selection is disabled.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      response: summary,
      facts: ["selector:disabled"],
      actions: [],
    });
  }
  const selection = await selectFairCandidate(
    command,
    config,
    reportRoot,
    await acceptedSelectorState(ctx),
  );
  const cursorFact = stateFact(selection.state);
  if (!selection.candidate) {
    const summary =
      "No eligible external Task candidate was found within selector bounds; the ordinary Task cursor advanced.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      response: summary,
      facts: ["selector:no-candidate", cursorFact],
      actions: [],
    });
  }
  const candidate = selection.candidate;
  await ctx.events.emit({
    type: "evaluation.task.review.requested",
    localKey: taskEmissionKey(
      ctx,
      `selected-${canonical(candidate.appId)}-${candidate.taskId}`,
    ),
    data: candidate,
    target: { appId: "evaluation", project: "evaluation" },
  });
  const summary = `Selected ${candidate.appId}/${candidate.taskId} for bounded outcome review.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    response: summary,
    facts: [`selected:${candidate.appId}/${candidate.taskId}`, cursorFact],
    actions: [],
  });
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return runTaskOutcomeSelector(ctx);
}
