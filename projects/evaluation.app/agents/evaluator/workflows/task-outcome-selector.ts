import { createHash } from "node:crypto";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  createPublicTaskEvidenceProvider,
  readSubjectTask,
  type PublicCommand,
} from "./lib/public-task-evidence.js";
import {
  configuredTaskReportRoot,
  readPublishedTaskReport,
  taskReportPaths,
} from "./lib/task-report-store.js";
import { assessmentContext } from "./lib/task-assessment-context.js";
import { reviewerProfile, type Reviewer } from "./lib/reviewer-profile.js";
import { memberEmissionKey, taskEmissionKey } from "./lib/task-emission.js";

export const name = "task-outcome-selector";
export const description =
  "Select at most one recent external Task candidate through bounded public App reads.";

const STATE_VERSION = 6;
const MAX_STATE_APPS = 20;
const MAX_STATE_HISTORY_BYTES = 6_000;
const MAX_NAVIGATION_FACT_BYTES = 3_000;
const MAX_NAVIGATION_FACTS = 20;
// HumanTaskStatus is the public tasks.list contract. `done` is a retained
// completion receipt, while `attention` is the current unresolved status.
const OPEN_STATUSES = new Set(["pending", "running", "waiting", "attention"]);
const OUTCOME_STATUSES = new Set(["up-to-date", "closed", "cancelled", "done"]);

type Input = { reason?: string };
type SelectorConfig = {
  enabled: boolean;
  reviewer?: Reviewer;
  intervalMs: number;
  maxApps: number;
  maxTasksPerApp: number;
  maxPagesPerApp: number;
  recentWindowMs: number;
};

type Candidate = {
  appId: string;
  taskId: string;
  assessmentPurpose?: "ongoing";
};
type AssessmentPurpose = "outcome" | "ongoing";
type SelectorState = {
  version: number;
  appId: string;
  appIndex: number;
  taskCursorByApp: Record<string, string>;
  unresolvedCursorByApp: Record<string, string>;
  unresolvedExhaustedByApp: Record<string, string>;
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
function catalogAppId(app: Record<string, unknown>): string {
  const identities = [app.appId, app.id].map(canonical).filter(Boolean);
  if (identities.includes("evaluation")) return "";
  return identities[0] ?? "";
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
    reviewer: reviewerProfile(env.EVALUATION_AUTO_REVIEW_REVIEWER).reviewer,
    intervalMs: bounded(
      env.EVALUATION_AUTO_REVIEW_INTERVAL_MS,
      86_400_000,
      604_800_000,
    ),
    maxApps: bounded(env.EVALUATION_AUTO_REVIEW_MAX_APPS, 20, MAX_STATE_APPS),
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
  if (facts.includes(fact) || facts.length >= MAX_NAVIGATION_FACTS) return;
  const candidate = [...facts, fact];
  if (Buffer.byteLength(JSON.stringify(candidate)) <= MAX_NAVIGATION_FACT_BYTES)
    facts.push(fact);
}
function assessmentPurposeFor(
  task: Record<string, unknown>,
  cutoff: number,
): AssessmentPurpose | null {
  if (!taskId(task)) return null;
  const status = canonical(task.status);
  if (OPEN_STATUSES.has(status)) return "ongoing";
  if (OUTCOME_STATUSES.has(status) && Number(task.updatedAt) >= cutoff)
    return "outcome";
  return null;
}
async function needsReview(
  appId: string,
  item: Record<string, unknown>,
  purpose: AssessmentPurpose,
  reviewer: Reviewer,
  reportRoot: string,
  command?: PublicCommand,
  nowMs = Date.now(),
): Promise<{ needed: boolean; unavailableReason?: string }> {
  const subject = await readSubjectTask(
    { appId, taskId: taskId(item) },
    command,
  );
  if (subject.disposition !== "eligible" || !subject.evidenceHash)
    return { needed: false, unavailableReason: subject.reason };
  const assessment = assessmentContext(subject, purpose, nowMs);
  const reportPath = taskReportPaths(
    canonical(appId),
    taskId(item),
    subject.evidenceHash,
    assessment.rubricVersion,
    assessment.validityIdentity,
    reviewer,
  ).jsonPath;
  const published = readPublishedTaskReport(reportRoot, reportPath);
  return {
    needed:
      !published ||
      canonical(published.appId) !== canonical(appId) ||
      published.taskId !== taskId(item) ||
      published.evidenceHash !== subject.evidenceHash ||
      published.purpose !== purpose ||
      published.validityIdentity !== assessment.validityIdentity,
  };
}
function emptyState(): SelectorState {
  return {
    version: STATE_VERSION,
    appId: "",
    appIndex: 0,
    taskCursorByApp: {},
    unresolvedCursorByApp: {},
    unresolvedExhaustedByApp: {},
  };
}
function boundedTaskCursors(value: unknown): Record<string, string> {
  const cursors: Record<string, string> = {};
  for (const [appId, storedValue] of Object.entries(object(value)).slice(
    -MAX_STATE_APPS,
  )) {
    const key = canonical(appId).slice(0, 80);
    const cursor = text(storedValue);
    // Cursors are opaque: never truncate one into a different token. The public
    // keyset token includes the full Task identity, so a supported long Task id
    // can legitimately exceed 512 bytes. The aggregate state budget remains
    // the bound.
    if (!key || !cursor || Buffer.byteLength(cursor) > MAX_STATE_HISTORY_BYTES)
      continue;
    const candidate = { ...cursors, [key]: cursor };
    if (Buffer.byteLength(JSON.stringify(candidate)) > MAX_STATE_HISTORY_BYTES)
      break;
    cursors[key] = cursor;
  }
  return cursors;
}
function cleanState(value: unknown): SelectorState {
  const item = object(value);
  const version = Number(item.version);
  if (version !== STATE_VERSION && version !== 5) return emptyState();
  const taskCursorByApp = boundedTaskCursors(item.taskCursorByApp);
  const unresolvedCursorByApp =
    version === STATE_VERSION
      ? boundedTaskCursors(item.unresolvedCursorByApp)
      : {};
  const unresolvedExhaustedByApp =
    version === STATE_VERSION
      ? boundedTaskCursors(item.unresolvedExhaustedByApp)
      : {};
  const history = {
    taskCursorByApp,
    unresolvedCursorByApp,
    unresolvedExhaustedByApp,
  };
  while (Buffer.byteLength(JSON.stringify(history)) > MAX_STATE_HISTORY_BYTES) {
    const map = [
      unresolvedExhaustedByApp,
      unresolvedCursorByApp,
      taskCursorByApp,
    ].find((candidate) => Object.keys(candidate).length);
    if (!map) break;
    delete map[Object.keys(map)[0]!];
  }
  return {
    version: STATE_VERSION,
    appId: /^[a-f0-9]{64}$/.test(text(item.appId)) ? text(item.appId) : "",
    appIndex: Math.max(0, Math.trunc(Number(item.appIndex) || 0)),
    ...history,
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
  const reviewer = reviewerProfile(config.reviewer).reviewer;
  const state = cleanState(priorState);
  const provider = createPublicTaskEvidenceProvider(command);
  const apps = [
    ...new Set(
      (await provider.listApps(config.maxApps))
        .map(catalogAppId)
        .filter(Boolean),
    ),
  ]
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
    let cursor = state.taskCursorByApp[key] ?? "";
    let continuationCursor = cursor;
    let unresolvedCursor = state.unresolvedCursorByApp[key] ?? "";
    let unresolvedContinuationCursor = unresolvedCursor;
    let unresolvedExhausted = state.unresolvedExhaustedByApp[key] === "1";
    const original = { cursor, unresolvedCursor, unresolvedExhausted };
    let pagesRead = 0;
    const seenCursors = new Set<string>(cursor ? [cursor] : []);
    let selected:
      | { item: Record<string, unknown>; purpose: AssessmentPurpose }
      | undefined;
    const considerUnresolved = async (item: Record<string, unknown>) => {
      const review = await needsReview(
        appId,
        item,
        "ongoing",
        reviewer,
        reportRoot,
        command,
        nowMs,
      );
      if (review.unavailableReason) {
        appendNavigationFact(
          navigationFacts,
          `selector-evidence-unavailable:${reportKey}:${identityDigest(taskId(item))}:${review.unavailableReason.replace(/\s+/g, " ").slice(0, 180)}`,
        );
      } else if (review.needed) {
        selected = { item, purpose: "ongoing" };
      }
    };
    try {
      const readLimit = Math.min(config.maxTasksPerApp, config.maxPagesPerApp);
      if (!unresolvedExhausted) {
        // Traverse one finite pass over the indexed unresolved view. The opaque
        // cursor advances before return, so a dropped review cannot pin the
        // pass. Arrivals ahead of the cursor are intentionally seen on the next
        // pass; failure events remain the immediate admission path.
        const seenUnresolvedCursors = new Set<string>(
          unresolvedCursor ? [unresolvedCursor] : [],
        );
        for (
          let pageIndex = 0;
          pageIndex < readLimit && !selected;
          pageIndex += 1
        ) {
          const unresolved = await provider.listUnresolvedTaskPage(
            appId,
            1,
            unresolvedCursor,
          );
          pagesRead += 1;
          for (const issue of unresolved.issues)
            appendNavigationFact(
              navigationFacts,
              navigationFailureFact(appId, pagesRead, issue),
            );
          unresolvedContinuationCursor = unresolved.nextCursor;
          const item = unresolved.items[0];
          if (item) await considerUnresolved(item);
          if (
            !unresolved.nextCursor ||
            seenUnresolvedCursors.has(unresolved.nextCursor)
          ) {
            unresolvedContinuationCursor = "";
            unresolvedExhausted = true;
            break;
          }
          seenUnresolvedCursors.add(unresolved.nextCursor);
          unresolvedCursor = unresolved.nextCursor;
        }
      }

      // A completed unresolved pass yields to exactly one bounded historical
      // turn before the filtered view starts fresh. Historical progress keeps
      // its independent opaque cursor across those refreshes.
      if (unresolvedExhausted && !selected) {
        for (
          let pageIndex = 0;
          pageIndex < readLimit && !selected;
          pageIndex += 1
        ) {
          const page = await provider.listRecentTaskPage(appId, 1, cursor);
          pagesRead += 1;
          for (const issue of page.issues)
            appendNavigationFact(
              navigationFacts,
              navigationFailureFact(appId, pagesRead, issue),
            );
          continuationCursor = page.nextCursor;
          const item = page.items[0];
          if (item) {
            const status = canonical(item.status);
            const purpose =
              status === "pending" ||
              status === "waiting" ||
              status === "attention"
                ? null
                : assessmentPurposeFor(item, cutoff);
            if (purpose) {
              const review = await needsReview(
                appId,
                item,
                purpose,
                reviewer,
                reportRoot,
                command,
                nowMs,
              );
              if (review.unavailableReason) {
                appendNavigationFact(
                  navigationFacts,
                  `selector-evidence-unavailable:${reportKey}:${identityDigest(taskId(item))}:${review.unavailableReason.replace(/\s+/g, " ").slice(0, 180)}`,
                );
              } else if (review.needed) {
                selected = { item, purpose };
              }
            }
          }
          if (!page.nextCursor || seenCursors.has(page.nextCursor)) {
            continuationCursor = "";
            break;
          }
          seenCursors.add(page.nextCursor);
          cursor = page.nextCursor;
        }
        unresolvedExhausted = false;
      }
    } catch (error) {
      // Retry the exact opaque boundaries and phase after a failed public read.
      continuationCursor = original.cursor;
      unresolvedContinuationCursor = original.unresolvedCursor;
      unresolvedExhausted = original.unresolvedExhausted;
      appendNavigationFact(
        navigationFacts,
        navigationFailureFact(appId, pagesRead, error),
      );
    }

    const nextIndex = (appIndex + 1) % apps.length;
    const taskCursorByApp = { ...nextState.taskCursorByApp };
    if (continuationCursor) taskCursorByApp[key] = continuationCursor;
    else delete taskCursorByApp[key];
    const unresolvedCursorByApp = { ...nextState.unresolvedCursorByApp };
    if (unresolvedContinuationCursor)
      unresolvedCursorByApp[key] = unresolvedContinuationCursor;
    else delete unresolvedCursorByApp[key];
    const unresolvedExhaustedByApp = {
      ...nextState.unresolvedExhaustedByApp,
    };
    if (unresolvedExhausted) unresolvedExhaustedByApp[key] = "1";
    else delete unresolvedExhaustedByApp[key];
    nextState = cleanState({
      version: STATE_VERSION,
      appId: appKey(apps[nextIndex]!),
      appIndex: nextIndex,
      taskCursorByApp,
      unresolvedCursorByApp,
      unresolvedExhaustedByApp,
    });
    if (continuationCursor)
      appendNavigationFact(
        navigationFacts,
        nextState.taskCursorByApp[key] === continuationCursor
          ? `selector-navigation-truncated:${reportKey}:pages-read=${pagesRead}:continuation-retained`
          : `selector-navigation-truncated:${reportKey}:pages-read=${pagesRead}:continuation-unretained`,
      );
    if (unresolvedContinuationCursor)
      appendNavigationFact(
        navigationFacts,
        nextState.unresolvedCursorByApp[key] === unresolvedContinuationCursor
          ? `selector-unresolved-navigation-truncated:${reportKey}:continuation-retained`
          : `selector-unresolved-navigation-truncated:${reportKey}:continuation-unretained`,
      );
    if (selected) {
      return {
        candidate: {
          appId,
          taskId: taskId(selected.item),
          ...(selected.purpose === "ongoing"
            ? { assessmentPurpose: "ongoing" as const }
            : {}),
        },
        state: nextState,
        navigationFacts,
      };
    }
  }
  return { candidate: null, state: nextState, navigationFacts };
}

export function retainedRequestedReviewTaskIds(
  ctx: WorkflowContext<Input>,
  reviewer: Reviewer = "evaluator",
): string[] {
  return (ctx.reconciliation?.taskSnapshot?.live ?? [])
    .filter((task) =>
      reviewer === "evaluator"
        ? task.taskId.startsWith("runtime/task-outcome/") &&
          !task.taskId.includes("/reviewer-") &&
          task.taskId !== "runtime/task-outcome-selector"
        : task.taskId.includes(`/reviewer-${reviewer}/`),
    )
    .map((task) => task.taskId)
    .sort();
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
  const reviewer = reviewerProfile(config.reviewer).reviewer;
  const priorState = await acceptedSelectorState(ctx);
  const retainedRequests = retainedRequestedReviewTaskIds(ctx, reviewer);
  const taskSnapshot = ctx.reconciliation?.taskSnapshot;
  const backlogUnknown = !taskSnapshot || taskSnapshot.truncated;
  if (retainedRequests.length || backlogUnknown) {
    const summary = retainedRequests.length
      ? `Deferred routine sampling while ${retainedRequests.length} retained requested review(s) use the shared semantic allowance.`
      : "Deferred routine sampling because the bounded Evaluation Task snapshot cannot prove that the requested-review backlog is empty.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      response: summary,
      facts: [
        retainedRequests.length
          ? `selector:requested-reviews-first:${retainedRequests.length}`
          : "selector:requested-review-backlog-unknown",
        ...(taskSnapshot?.truncated
          ? ["selector:task-snapshot-truncated"]
          : []),
        selectorStateFact(priorState),
        ...retainedRequests
          .slice(0, 8)
          .map((taskId) => `requested-review:${taskId}`),
      ],
      actions: [],
    });
  }
  const selection = await selectFairCandidate(
    command,
    config,
    reportRoot,
    priorState,
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
    localKey: taskEmissionKey(
      ctx,
      memberEmissionKey(
        reviewer === "evaluator" ? "selected" : `selected-${reviewer}`,
        candidate,
      ),
    ),
    data: {
      ...candidate,
      ...(reviewer === "evaluator" ? {} : { reviewer }),
    },
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
