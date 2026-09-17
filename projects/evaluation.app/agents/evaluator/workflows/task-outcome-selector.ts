import { createHash } from "node:crypto";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  createPublicTaskEvidenceProvider,
  type PublicCommand,
} from "./lib/public-task-evidence.js";
import {
  configuredTaskReportRoot,
  listTaskReports,
} from "./lib/task-report-store.js";
import { memberEmissionKey, taskEmissionKey } from "./lib/task-emission.js";

export const name = "task-outcome-selector";
export const description =
  "Select at most one recent external Task candidate through bounded public App reads.";

const STATE_VERSION = 3;
const MAX_STATE_APPS = 20;
const MAX_STATE_HISTORY_BYTES = 6_000;
const MAX_NAVIGATION_FACT_BYTES = 3_000;
const MAX_NAVIGATION_FACTS = 20;
const REVIEWABLE_STATUSES = new Set([
  "up-to-date",
  "closed",
  "cancelled",
  "needs-attention",
]);

type Input = { reason?: string };
type SelectorConfig = {
  enabled: boolean;
  intervalMs: number;
  maxApps: number;
  maxTasksPerApp: number;
  maxPagesPerApp: number;
  recentWindowMs: number;
};

type Candidate = { appId: string; taskId: string };
type SelectorState = {
  version: number;
  appId: string;
  appIndex: number;
  lastTaskByApp: Record<string, string>;
};
type Selection = {
  candidate: Candidate | null;
  state: SelectorState;
  navigationFacts: string[];
};

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
    maxPagesPerApp: bounded(env.EVALUATION_AUTO_REVIEW_MAX_PAGES_PER_APP, 2, 5),
    recentWindowMs: bounded(
      env.EVALUATION_AUTO_REVIEW_RECENT_WINDOW_MS,
      7 * 86_400_000,
      30 * 86_400_000,
    ),
  };
}

function taskId(task: Record<string, unknown>): string {
  return text(task.taskId ?? task.id);
}
function identityDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function appKey(value: string): string {
  return identityDigest(canonical(value));
}
function resultIdentity(candidate: Candidate): string {
  return `${canonical(candidate.appId).slice(0, 80)}/${identityDigest(candidate.taskId)}`;
}
function navigationFailureFact(
  appId: string,
  pagesRead: number,
  error: unknown,
): string {
  const message =
    error instanceof Error ? error.message : text(error) || "unknown failure";
  const boundedMessage = message.replace(/\s+/g, " ").slice(0, 180);
  return `selector-navigation-failed:${canonical(appId).slice(0, 80)}:pages-read=${pagesRead}:${boundedMessage}`;
}
function appendNavigationFact(facts: string[], fact: string): void {
  if (facts.length >= MAX_NAVIGATION_FACTS) return;
  const candidate = [...facts, fact];
  if (Buffer.byteLength(JSON.stringify(candidate)) <= MAX_NAVIGATION_FACT_BYTES)
    facts.push(fact);
}
function isReviewable(task: Record<string, unknown>): boolean {
  return (
    Boolean(taskId(task)) && REVIEWABLE_STATUSES.has(canonical(task.status))
  );
}
function emptyState(): SelectorState {
  return { version: STATE_VERSION, appId: "", appIndex: 0, lastTaskByApp: {} };
}
function boundedStateHistory(value: unknown): Record<string, string> {
  const history: Record<string, string> = {};
  for (const [appId, storedValue] of Object.entries(object(value)).slice(
    -MAX_STATE_APPS,
  )) {
    const key = canonical(appId).slice(0, 80);
    const id = text(storedValue);
    if (!key || !/^[a-f0-9]{64}$/.test(id)) continue;
    const candidate = { ...history, [key]: id };
    if (Buffer.byteLength(JSON.stringify(candidate)) > MAX_STATE_HISTORY_BYTES)
      break;
    history[key] = id;
  }
  return history;
}
function cleanState(value: unknown): SelectorState {
  const item = object(value);
  if (Number(item.version) !== STATE_VERSION) return emptyState();
  return {
    version: STATE_VERSION,
    appId: /^[a-f0-9]{64}$/.test(text(item.appId)) ? text(item.appId) : "",
    appIndex: Math.max(0, Math.trunc(Number(item.appIndex) || 0)),
    lastTaskByApp: boundedStateHistory(item.lastTaskByApp),
  };
}
export function selectorStateFact(state: SelectorState): string {
  return `selector-state:${Buffer.from(JSON.stringify(cleanState(state))).toString("base64url")}`;
}
function stateFromFacts(facts: string[]): SelectorState {
  const encoded = facts.find((fact) => fact.startsWith("selector-state:"));
  if (!encoded) return emptyState();
  try {
    return cleanState(
      JSON.parse(Buffer.from(encoded.slice(15), "base64url").toString("utf8")),
    );
  } catch {
    return emptyState();
  }
}

async function acceptedSelectorState(
  ctx: WorkflowContext<Input>,
): Promise<SelectorState> {
  const taskId = ctx.reconciliation?.taskId;
  if (!taskId) return emptyState();
  try {
    const response = object(await ctx.read.tasks.get(taskId));
    const task = Object.keys(object(response.task)).length
      ? object(response.task)
      : response;
    return stateFromFacts(strings(task.facts ?? object(task.result).facts));
  } catch {
    return emptyState();
  }
}

export async function selectFairCandidate(
  command?: PublicCommand,
  config = automaticReviewConfig(),
  reportRoot = configuredTaskReportRoot(),
  priorState: SelectorState = emptyState(),
  nowMs = Date.now(),
): Promise<Selection> {
  if (!config.enabled)
    return {
      candidate: null,
      state: cleanState(priorState),
      navigationFacts: [],
    };
  const state = cleanState(priorState);
  const provider = createPublicTaskEvidenceProvider(command);
  const reviewed = new Set(
    listTaskReports(reportRoot, 100).map(
      (report) => `${canonical(report.appId)}\u0000${report.taskId}`,
    ),
  );
  const apps = (await provider.listApps(config.maxApps))
    .map((app) => text(app.id ?? app.appId))
    .filter((id) => id && canonical(id) !== "evaluation")
    .sort((a, b) => a.localeCompare(b))
    .slice(0, config.maxApps);
  if (!apps.length)
    return { candidate: null, state: emptyState(), navigationFacts: [] };

  const rememberedIndex = apps.findIndex(
    (appId) => appKey(appId) === state.appId,
  );
  const start =
    rememberedIndex >= 0 ? rememberedIndex : state.appIndex % apps.length;
  let nextState = state;
  const navigationFacts: string[] = [];
  const cutoff = nowMs - config.recentWindowMs;

  for (let offset = 0; offset < apps.length; offset += 1) {
    const appIndex = (start + offset) % apps.length;
    const appId = apps[appIndex]!;
    const key = appKey(appId);
    const reportKey = canonical(appId);
    const recent: Record<string, unknown>[] = [];
    let cursor = "";
    let pagesRead = 0;
    const seenCursors = new Set<string>();
    try {
      for (
        let pageIndex = 0;
        pageIndex < config.maxPagesPerApp;
        pageIndex += 1
      ) {
        const page = await provider.listRecentTaskPage(
          appId,
          config.maxTasksPerApp,
          cursor,
        );
        pagesRead += 1;
        let reachedWindowBoundary = false;
        for (const item of page.items) {
          if (Number(item.updatedAt) < cutoff) {
            reachedWindowBoundary = true;
            break;
          }
          if (isReviewable(item)) recent.push(item);
        }
        if (
          reachedWindowBoundary ||
          !page.nextCursor ||
          seenCursors.has(page.nextCursor)
        )
          break;
        seenCursors.add(page.nextCursor);
        cursor = page.nextCursor;
      }
    } catch (error) {
      // A malformed or unavailable App page is neutral coverage failure. Rotate,
      // but retain bounded diagnostics rather than reporting healthy emptiness.
      appendNavigationFact(
        navigationFacts,
        navigationFailureFact(appId, pagesRead, error),
      );
    }

    const rememberedTask = state.lastTaskByApp[key];
    const rememberedTaskIndex = rememberedTask
      ? recent.findIndex(
          (item) => identityDigest(taskId(item)) === rememberedTask,
        )
      : -1;
    const candidates = recent.slice(
      rememberedTaskIndex >= 0 ? rememberedTaskIndex + 1 : 0,
    );
    const selected = candidates.find(
      (item) => !reviewed.has(`${reportKey}\u0000${taskId(item)}`),
    );
    const nextIndex = (appIndex + 1) % apps.length;
    const lastTaskByApp = { ...state.lastTaskByApp };
    if (selected) lastTaskByApp[key] = identityDigest(taskId(selected));
    else if (rememberedTaskIndex >= 0) delete lastTaskByApp[key];
    const boundedHistory = boundedStateHistory(lastTaskByApp);
    nextState = {
      version: STATE_VERSION,
      appId: appKey(apps[nextIndex]!),
      appIndex: nextIndex,
      lastTaskByApp: boundedHistory,
    };
    if (selected) {
      return {
        candidate: { appId, taskId: taskId(selected) },
        state: nextState,
        navigationFacts,
      };
    }
  }
  return { candidate: null, state: nextState, navigationFacts };
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
  const cursorFact = selectorStateFact(selection.state);
  if (!selection.candidate) {
    const summary =
      "No eligible recent external Task candidate was found within selector bounds; ordinary Task navigation advanced.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      response: summary,
      facts: [
        "selector:no-candidate",
        cursorFact,
        ...selection.navigationFacts,
      ],
      actions: [],
    });
  }
  const candidate = selection.candidate;
  const selectedIdentity = resultIdentity(candidate);
  await ctx.events.emit({
    type: "evaluation.task.review.requested",
    localKey: taskEmissionKey(ctx, memberEmissionKey("selected", candidate)),
    data: candidate,
    target: { appId: "evaluation", project: "evaluation" },
  });
  const summary = `Selected ${selectedIdentity} for bounded outcome review; the emitted request retains the exact Task identity.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    response: summary,
    facts: [
      `selected:${selectedIdentity}`,
      cursorFact,
      ...selection.navigationFacts,
    ],
    actions: [],
  });
}

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  return runTaskOutcomeSelector(ctx);
}
