import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";

export const name = "project-health-evaluator";
export const description =
  "Run one bounded independent App audit and publish an Evaluation-owned report and routed findings.";
export const PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE =
  "persistent-task: skip";

const NOTIFY_VERDICTS = new Set(["concern", "urgent", "blocked-on-human"]);
const ACTIONABLE_HUMAN_REQUESTS = new Set([
  "approve",
  "decide",
  "provide-input",
]);
const HUMAN_REQUESTS = new Set([
  "none",
  "watch",
  ...ACTIONABLE_HUMAN_REQUESTS,
  "assign-owner",
]);
const VERDICTS = new Set([
  "ok",
  "watch",
  "concern",
  "urgent",
  "blocked-on-human",
]);
const OWNER_FEEDBACK_RETRY_MS = 60 * 60_000;

export type ProjectHealthInput = {
  targetProject: string;
};

export type ProjectHealthJudgment = {
  verdict: string;
  mainConcern: string;
  affectedArtifacts: string[];
  recommendedChange: string;
  verification: string[];
  requestedHumanAction: string;
  notify: boolean;
  dedupeKey: string;
  message: string;
  observations: Record<string, unknown>;
  evaluatorWantedNotify?: boolean;
  notificationReason?: string;
};

export type ProjectHealthState = {
  targetProject?: string;
  lastReviewedAt?: string;
  lastCheckedAt?: string;
  lastReportPath?: string;
  lastVerdict?: string;
  lastDedupeKey?: string;
  lastRequestedHumanAction?: string;
  lastNotify?: boolean;
  lastInputFingerprint?: string;
  lastFeedbackAt?: string;
  lastFeedbackDedupeKey?: string;
  lastFeedbackVerdict?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 40)
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeTarget(value: unknown): string {
  const target = text(value);
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(target) &&
    target !== "." &&
    target !== ".."
    ? target
    : "";
}

function appIdForTarget(targetProject: string): string {
  return targetProject.replace(/\.app$/, "");
}

function severity(verdict: string | undefined): number {
  switch (verdict) {
    case "urgent":
      return 4;
    case "blocked-on-human":
      return 3;
    case "concern":
      return 2;
    case "watch":
      return 1;
    default:
      return 0;
  }
}

function dedupeFamily(value: string | undefined): string {
  const key = text(value);
  if (!key) return "";
  const project = key.split(":")[0] || "";
  if (/approval/i.test(key)) return `${project}:approval`;
  if (/review[-_]?failed|workflow[-_]?blocked|provider/i.test(key)) {
    return `${project}:audit-execution`;
  }
  return key;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalValue(item)]),
  );
}

export function projectHealthInputFingerprint(
  judgment: Pick<
    ProjectHealthJudgment,
    | "verdict"
    | "mainConcern"
    | "affectedArtifacts"
    | "recommendedChange"
    | "verification"
    | "requestedHumanAction"
    | "dedupeKey"
    | "observations"
  >,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(judgment)))
    .digest("hex")
    .slice(0, 20);
}

export function scheduledProjectReviewDecision(
  reason: string,
  previous: ProjectHealthState,
  fingerprint: string,
  now = Date.now(),
): { run: boolean; reason: string } {
  if (reason !== "scheduled") return { run: true, reason: "explicit-request" };
  if (!previous.lastReviewedAt) return { run: true, reason: "first-review" };
  if (previous.lastInputFingerprint !== fingerprint) {
    return { run: true, reason: "meaningful-delta" };
  }
  const reviewedAt = Date.parse(previous.lastReviewedAt);
  if (!Number.isFinite(reviewedAt) || now - reviewedAt >= 24 * 60 * 60_000) {
    return { run: true, reason: "daily-baseline" };
  }
  return { run: false, reason: "unchanged-since-last-review" };
}

function fallbackJudgment(
  targetProject: string,
  execution: ExecutionResult,
): ProjectHealthJudgment {
  return {
    verdict: "watch",
    mainConcern: `The independent audit execution ended ${execution.status}: ${execution.summary}`,
    affectedArtifacts: [],
    recommendedChange:
      "Retry the independent audit after the evaluator execution path is healthy; do not infer a target-App defect from this failure.",
    verification: [
      "A later evaluator execution returns a complete structured project-health judgment.",
    ],
    requestedHumanAction: "none",
    notify: false,
    dedupeKey: `${targetProject}:audit-execution-${execution.status}`,
    message:
      "No target-owner or human action is requested from an incomplete audit.",
    observations: {
      auditExecutionId: execution.id,
      auditExecutionStatus: execution.status,
      auditExecutionSummary: execution.summary,
    },
  };
}

export function normalizeJudgment(
  value: unknown,
  fallback: ProjectHealthJudgment,
): ProjectHealthJudgment {
  const outer = record(value);
  const raw =
    Object.keys(record(outer.judgment)).length > 0
      ? record(outer.judgment)
      : outer;
  const verdict = VERDICTS.has(text(raw.verdict))
    ? text(raw.verdict)
    : fallback.verdict;
  const affectedArtifacts = strings(
    raw.affectedArtifacts ?? raw.affected_artifacts,
  );
  const verification = strings(raw.verification);
  const observations = record(raw.observations ?? outer.observations);
  return {
    verdict,
    mainConcern:
      text(raw.mainConcern ?? raw.main_concern) || fallback.mainConcern,
    affectedArtifacts:
      affectedArtifacts.length > 0
        ? affectedArtifacts
        : fallback.affectedArtifacts,
    recommendedChange:
      text(raw.recommendedChange ?? raw.recommended_change) ||
      fallback.recommendedChange,
    verification:
      verification.length > 0 ? verification : fallback.verification,
    requestedHumanAction:
      text(raw.requestedHumanAction ?? raw.requested_human_action) ||
      fallback.requestedHumanAction,
    notify:
      typeof raw.notify === "boolean"
        ? raw.notify
        : NOTIFY_VERDICTS.has(verdict),
    dedupeKey: text(raw.dedupeKey ?? raw.dedupe_key) || fallback.dedupeKey,
    message: text(raw.message) || fallback.message,
    observations:
      Object.keys(observations).length > 0
        ? observations
        : fallback.observations,
  };
}

export function reconcileJudgment(
  targetProject: string,
  judgment: ProjectHealthJudgment,
): ProjectHealthJudgment {
  if (judgment.requestedHumanAction.toLowerCase() !== "assign-owner")
    return judgment;
  return {
    ...judgment,
    verdict:
      severity(judgment.verdict) > severity("watch")
        ? judgment.verdict
        : "watch",
    mainConcern:
      "The target App already has a declared owner; route the finding there instead of asking Hao to assign routine ownership.",
    requestedHumanAction: "none",
    notify: false,
    dedupeKey: `${targetProject}:declared-owner-follow-up`,
    message:
      "The declared App owner should judge this finding and create or link exact work when it is valid.",
  };
}

export function projectHealthJudgmentFromExecution(
  targetProject: string,
  execution: ExecutionResult,
): { judgment: ProjectHealthJudgment; complete: boolean } {
  const fallback = fallbackJudgment(targetProject, execution);
  if (execution.status !== "done")
    return { judgment: fallback, complete: false };
  const candidate = record(execution.output);
  const raw =
    Object.keys(record(candidate.judgment)).length > 0
      ? record(candidate.judgment)
      : candidate;
  const verification = strings(raw.verification);
  const observations = record(raw.observations ?? candidate.observations);
  const affectedArtifacts = strings(
    raw.affectedArtifacts ?? raw.affected_artifacts,
  );
  const verdict = text(raw.verdict);
  const complete = Boolean(
    VERDICTS.has(verdict) &&
    text(raw.mainConcern ?? raw.main_concern) &&
    Array.isArray(raw.affectedArtifacts ?? raw.affected_artifacts) &&
    (verdict === "ok" || affectedArtifacts.length > 0) &&
    text(raw.recommendedChange ?? raw.recommended_change) &&
    verification.length > 0 &&
    HUMAN_REQUESTS.has(
      text(
        raw.requestedHumanAction ?? raw.requested_human_action,
      ).toLowerCase(),
    ) &&
    typeof raw.notify === "boolean" &&
    text(raw.dedupeKey ?? raw.dedupe_key) &&
    text(raw.message) &&
    Object.keys(observations).length > 0,
  );
  return {
    judgment: reconcileJudgment(
      targetProject,
      normalizeJudgment(candidate, fallback),
    ),
    complete,
  };
}

export function shouldNotify(
  judgment: ProjectHealthJudgment,
  previous: ProjectHealthState,
): boolean {
  if (
    !ACTIONABLE_HUMAN_REQUESTS.has(judgment.requestedHumanAction.toLowerCase())
  )
    return false;
  if (!NOTIFY_VERDICTS.has(judgment.verdict) || !judgment.notify) return false;
  const previousAction = text(previous.lastRequestedHumanAction).toLowerCase();
  if (
    previous.lastRequestedHumanAction !== undefined &&
    !ACTIONABLE_HUMAN_REQUESTS.has(previousAction)
  )
    return true;
  if (dedupeFamily(previous.lastDedupeKey) !== dedupeFamily(judgment.dedupeKey))
    return true;
  if (
    previous.lastRequestedHumanAction !== undefined &&
    previousAction !== judgment.requestedHumanAction.toLowerCase()
  )
    return true;
  return severity(judgment.verdict) > severity(previous.lastVerdict);
}

export function shouldFeedbackTargetOwner(
  judgment: ProjectHealthJudgment,
  previous: ProjectHealthState,
  options: { force?: boolean; now?: number; retryAfterMs?: number } = {},
): boolean {
  if (judgment.verdict === "ok") return false;
  if (options.force) return true;
  if (!previous.lastFeedbackDedupeKey) return true;
  if (
    dedupeFamily(previous.lastFeedbackDedupeKey) !==
    dedupeFamily(judgment.dedupeKey)
  ) {
    return true;
  }
  if (severity(judgment.verdict) > severity(previous.lastFeedbackVerdict))
    return true;
  const lastFeedbackAt = Date.parse(previous.lastFeedbackAt ?? "");
  const now = options.now ?? Date.now();
  return (
    !Number.isFinite(lastFeedbackAt) ||
    now - lastFeedbackAt >= (options.retryAfterMs ?? OWNER_FEEDBACK_RETRY_MS)
  );
}

function stateFile(workspaceRoot: string, targetProject: string): string {
  return join(
    workspaceRoot,
    "generated",
    "project-health-state",
    "targets",
    `${targetProject}.json`,
  );
}

function readState(
  workspaceRoot: string,
  targetProject: string,
): ProjectHealthState {
  const path = stateFile(workspaceRoot, targetProject);
  if (!existsSync(path)) return {};
  try {
    return record(JSON.parse(readFileSync(path, "utf8"))) as ProjectHealthState;
  } catch {
    return {};
  }
}

export function projectHealthStateUpdate(
  previous: ProjectHealthState,
  targetProject: string,
  judgment: ProjectHealthJudgment,
  reportPath: string,
  inputFingerprint: string,
  feedbackEmitted: boolean,
  now = new Date().toISOString(),
): ProjectHealthState {
  return {
    ...previous,
    targetProject,
    lastReviewedAt: now,
    lastCheckedAt: now,
    lastReportPath: reportPath,
    lastVerdict: judgment.verdict,
    lastDedupeKey: judgment.dedupeKey,
    lastRequestedHumanAction: judgment.requestedHumanAction,
    lastNotify: judgment.notify,
    lastInputFingerprint: inputFingerprint,
    ...(feedbackEmitted
      ? {
          lastFeedbackAt: now,
          lastFeedbackDedupeKey: judgment.dedupeKey,
          lastFeedbackVerdict: judgment.verdict,
        }
      : {}),
  };
}

function writeState(
  workspaceRoot: string,
  state: ProjectHealthState,
  targetProject: string,
): void {
  const path = stateFile(workspaceRoot, targetProject);
  mkdirSync(
    join(workspaceRoot, "generated", "project-health-state", "targets"),
    { recursive: true },
  );
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function projectHealthPublication(
  targetProject: string,
  judgment: ProjectHealthJudgment,
  execution: ExecutionResult,
): { facts: Record<string, unknown>; report: string } {
  const facts = {
    targetProject,
    auditExecution: {
      id: execution.id,
      status: execution.status,
      summary: execution.summary,
    },
    observations: judgment.observations,
    judgment: {
      verdict: judgment.verdict,
      mainConcern: judgment.mainConcern,
      affectedArtifacts: judgment.affectedArtifacts,
      recommendedChange: judgment.recommendedChange,
      verification: judgment.verification,
      requestedHumanAction: judgment.requestedHumanAction,
      evaluatorWantedNotify: judgment.evaluatorWantedNotify,
      notify: judgment.notify,
      dedupeKey: judgment.dedupeKey,
      message: judgment.message,
      notificationReason: judgment.notificationReason,
    },
  };
  const report = `# Project Health Review

Project: ${targetProject}
Verdict: ${judgment.verdict}
Main concern: ${judgment.mainConcern}
Requested human action: ${judgment.requestedHumanAction}
Dedupe key: ${judgment.dedupeKey}

## Affected Artifacts

${judgment.affectedArtifacts.map((item) => `- ${item}`).join("\n") || "- None identified"}

## Recommended Change

${judgment.recommendedChange}

## Verification

${judgment.verification.map((item) => `- ${item}`).join("\n") || "- A later independent audit no longer observes the concern."}

## Owner Message

${judgment.message}

## Structured Facts

\`\`\`json
${JSON.stringify(facts, null, 2)}
\`\`\`
`;
  return { facts, report };
}

export function pruneProjectHealthReports(
  reportDir: string,
  keepReviews = 30,
): void {
  if (!existsSync(reportDir)) return;
  const reports = readdirSync(reportDir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .reverse();
  for (const report of reports.slice(keepReviews)) {
    const id = report.slice(0, -3);
    for (const entry of [report, `${id}.facts.json`]) {
      const path = join(reportDir, entry);
      if (existsSync(path)) unlinkSync(path);
    }
  }
}

function writeReport(
  workspaceRoot: string,
  targetProject: string,
  judgment: ProjectHealthJudgment,
  execution: ExecutionResult,
): string {
  const reportDir = join(
    workspaceRoot,
    "reports",
    "project-health",
    targetProject,
  );
  mkdirSync(reportDir, { recursive: true });
  const id = new Date().toISOString().replace(/[-:.]/g, "");
  const publication = projectHealthPublication(
    targetProject,
    judgment,
    execution,
  );
  const factsPath = join(reportDir, `${id}.facts.json`);
  const reportPath = join(reportDir, `${id}.md`);
  writeFileSync(
    factsPath,
    `${JSON.stringify(publication.facts, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(reportPath, publication.report, "utf8");
  pruneProjectHealthReports(reportDir);
  return relative(workspaceRoot, reportPath);
}

function triggerReason(ctx: WorkflowContext<ProjectHealthInput>): string {
  const data = record(ctx.reconciliation?.trigger?.data);
  return text(data.reason) || "scheduled";
}

export function projectHealthEvaluatorAgentPrompt(
  target: { targetProject: string; reason: string },
  trigger: unknown = null,
): string {
  return `${PROJECT_HEALTH_EVALUATOR_AGENT_PROMPT_PREAMBLE}

Independently audit the current health of Agent App ${target.targetProject}.
Reason: ${target.reason}

This is one bounded evidence collection and judgment attempt. Use read-only tools and query_db to inspect current public evidence for this target: its canonical App declaration, generated task projection, recent relevant metrics/events/workflow outcomes, Git state when relevant, and the previous Evaluation-owned report. Do not mutate the target, send a message, create work, or use host-private task state. Prefer current direct observations over stale alerts.

Return through finish() with result exactly shaped as:
{
  "verdict": "ok|watch|concern|urgent|blocked-on-human",
  "mainConcern": "one evidence-backed sentence",
  "affectedArtifacts": ["specific public artifact or task identity"],
  "recommendedChange": "concrete correction for the declared target owner",
  "verification": ["observable proof condition"],
  "requestedHumanAction": "none|watch|decide|approve|provide-input",
  "notify": false,
  "dedupeKey": "${target.targetProject}:stable-concern-family",
  "message": "concise owner-facing finding",
  "observations": {
    "task": "bounded current task summary",
    "metrics": "bounded current metric summary",
    "runtime": "bounded current event/workflow summary",
    "sourceRevisions": ["artifact/revision pairs used"]
  }
}

Set notify=true only when requestedHumanAction is decide, approve, or provide-input and the human decision is genuinely required now. The target already has an App owner, so never request assign-owner. If evidence is unavailable or contradictory, return watch with the exact missing proof and no human notification.

Every non-ok judgment must name at least one exact public affected artifact. For approval-delivery concerns, cite the exact public event ID as \`event:<id>#project.approval.requested#approvalId=<id>\` (and any later delivery or superseding event), not an empty artifact list, a generic stale-escalation claim, or a host-private \`.state\` ledger path. A non-ok judgment without an exact named artifact is incomplete and will be rejected rather than routed to the target owner.

Exact wake fact:
\`\`\`json
${JSON.stringify(trigger, null, 2)}
\`\`\``;
}

function reconciled(
  summary: string,
  evidence: string[] = [],
): TaskReconcileResult {
  return { state: "converged", summary, evidence, actions: [] };
}

export async function execute(
  ctx: WorkflowContext<ProjectHealthInput>,
): Promise<ExecutionResult> {
  const targetProject = safeTarget(ctx.input?.targetProject);
  if (!ctx.reconciliation) {
    return ctx.blocked(
      "project-health-evaluator requires canonical reconciliation context",
    );
  }
  if (!ctx.workspace?.root) {
    return ctx.blocked(
      "project-health-evaluator requires an allocated App workspace",
    );
  }
  if (!targetProject) {
    return ctx.blocked(
      "project-health-evaluator requires a safe targetProject",
    );
  }

  const reason = triggerReason(ctx);
  const previous = readState(ctx.workspace.root, targetProject);
  await ctx.events.emit({
    type: "evaluation.project.review_started",
    data: { targetProject, reason },
    target: { appId: "evaluation", project: "evaluation" },
  });

  const execution = await ctx.agents.call(
    "evaluator",
    projectHealthEvaluatorAgentPrompt(
      { targetProject, reason },
      ctx.reconciliation.trigger ?? null,
    ),
  );
  const audit = projectHealthJudgmentFromExecution(targetProject, execution);

  if (!audit.complete) {
    await ctx.events.emit({
      type: "evaluation.project.review_failed",
      data: {
        targetProject,
        reason,
        executionId: execution.id,
        status: execution.status,
        summary: execution.summary,
      },
      target: { appId: "evaluation", project: "evaluation" },
    });
    return ctx.blocked(
      `${targetProject} project/App review produced no complete judgment: ${execution.summary}`,
      [`execution:${execution.id}`, `status:${execution.status}`],
    );
  }

  const fingerprint = projectHealthInputFingerprint(audit.judgment);
  const reviewDecision = scheduledProjectReviewDecision(
    reason,
    previous,
    fingerprint,
  );

  if (!reviewDecision.run) {
    writeState(
      ctx.workspace.root,
      {
        ...previous,
        targetProject,
        lastCheckedAt: new Date().toISOString(),
        lastInputFingerprint: fingerprint,
      },
      targetProject,
    );
    const summary = `${targetProject} project/App review skipped: ${reviewDecision.reason}.`;
    await ctx.events.emit({
      type: "evaluation.project.review_skipped",
      data: { targetProject, reason: reviewDecision.reason, fingerprint },
      target: { appId: "evaluation", project: "evaluation" },
    });
    return ctx.done(summary, reconciled(summary));
  }

  const judgment = { ...audit.judgment };
  const ownerFeedback = shouldFeedbackTargetOwner(judgment, previous, {
    force: reviewDecision.reason === "explicit-request",
  });
  const humanNotification = shouldNotify(judgment, previous);
  judgment.evaluatorWantedNotify = judgment.notify;
  judgment.notify = humanNotification;
  judgment.notificationReason = humanNotification
    ? "A new or more severe actionable human decision is required."
    : "No new actionable human decision requires delivery.";

  const reportPath = writeReport(
    ctx.workspace.root,
    targetProject,
    judgment,
    execution,
  );
  writeState(
    ctx.workspace.root,
    projectHealthStateUpdate(
      previous,
      targetProject,
      judgment,
      reportPath,
      fingerprint,
      ownerFeedback,
    ),
    targetProject,
  );

  const reviewed = {
    targetProject,
    verdict: judgment.verdict,
    reportPath,
    summary: judgment.mainConcern,
    affectedArtifacts: judgment.affectedArtifacts,
    recommendedChange: judgment.recommendedChange,
    verification: judgment.verification,
    requestedHumanAction: judgment.requestedHumanAction,
    notify: judgment.notify,
    dedupeKey: judgment.dedupeKey,
    executionId: execution.id,
    reviewReason: reviewDecision.reason,
    feedbackEmitted: ownerFeedback,
  };
  await ctx.events.emit({
    type: "evaluation.project.reviewed",
    data: reviewed,
    target: { appId: "evaluation", project: "evaluation" },
  });

  if (ownerFeedback) {
    const appId = appIdForTarget(targetProject);
    await ctx.events.emit({
      type: "project.owner.requested",
      data: {
        project: appId,
        reason: "evaluation-project-health-feedback",
        finding: reviewed,
        message: judgment.message,
      },
      target: { appId, project: appId },
    });
  }

  if (humanNotification) {
    await ctx.events.emit({
      type: "evaluation.human_decision.requested",
      data: {
        targetProject,
        reportPath,
        verdict: judgment.verdict,
        requestedHumanAction: judgment.requestedHumanAction,
        message: `${targetProject} needs ${judgment.requestedHumanAction}: ${judgment.mainConcern}\n\n${judgment.message}`,
        dedupeKey: judgment.dedupeKey,
      },
      target: { appId: "may", project: "may" },
    });
  }

  const summary = `${targetProject} project/App review: ${judgment.verdict}. Report: ${reportPath}.`;
  return ctx.done(
    summary,
    reconciled(summary, [`report:${reportPath}`, `execution:${execution.id}`]),
  );
}
