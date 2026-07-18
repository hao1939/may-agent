/**
 * task-reviewer — read-only first-pass review for completed task output.
 *
 * Handles project.task.completed by validating that the cited task is still in
 * live review state, asking an independent reviewer for a structured judgment,
 * and emitting project.task.reviewed for the planner to apply. This workflow
 * must not mutate the task tree.
 */

import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  readTaskTree,
  taskRevision,
  type TaskNode,
} from "./lib/task-tree-store.ts";
import { taskTreeConfig } from "./lib/task-tree-tools.ts";
import {
  field,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  triggerBlock,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";
import {
  deliverPendingActionV2,
  reviewApplicationPendingActionV2,
  type PendingActionDeliveryResultV2,
} from "./lib/project-pending-actions-v2.ts";
import {
  appendPendingActionDeliveryReceiptV2,
  appendReviewerLedgerRowV2,
  pendingActionDeliveryReceiptsV2,
  readReviewerLedgerRowsV2,
} from "./lib/project-review-delivery-v2.ts";
import { featureScenarioCarrierViolationsForTaskOutputs } from "./lib/feature-scenario-carrier-contract.ts";

export const name = "task-reviewer";
export const description =
  "Read-only review of completed task output before planner tree mutation.";

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
    opts?: { timeoutMs?: number },
  ) => Promise<unknown>;
};

type ReviewDecision = "accept" | "redo" | "followup" | "blocked" | "escalate";
type ReviewConfidence = "high" | "medium" | "low";

type ReviewedEvent = {
  type: string;
  owner?: string;
  target?: Record<string, unknown>;
  data: Record<string, unknown>;
};

type StructuredReview = {
  decision: ReviewDecision;
  confidence: ReviewConfidence;
  summary: string;
  findings: string[];
  feedback: string[];
  suggestedFollowups: string[];
  artifacts: string[];
  verification: string[];
  events: ReviewedEvent[];
  reviewAction?: Record<string, unknown>;
};

type ReviewValidationNotes = {
  findings: string[];
  feedback: string[];
  suggestedFollowups: string[];
};

const EMPTY_ASSISTANT_TURN = "Agent ended with an empty assistant turn";

function taskState(task: TaskNode): string {
  const state = task.status ?? task.state;
  return typeof state === "string" ? state : "backlog";
}

function taskTrace(task: TaskNode): Record<string, unknown> {
  return task.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function taskContextString(task: TaskNode, key: string): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const NORMALIZATION_ISOLATED_WORKTREE_ROOT =
  "domain/normalize-scenario-tests-repo-frontier-20260715";

function taskHasAncestorId(
  tree: ReturnType<typeof readTaskTree>,
  taskId: string,
  ancestorId: string,
): boolean {
  let currentId: string | undefined = taskId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    if (currentId === ancestorId) return true;
    seen.add(currentId);
    const task = tree.tasks[currentId];
    currentId =
      task && typeof task.parent_id === "string" && task.parent_id.trim()
        ? task.parent_id.trim()
        : undefined;
  }
  return false;
}

function requiresNormalizationIsolatedWorktreeReview(
  tree: ReturnType<typeof readTaskTree>,
  taskId: string,
): boolean {
  return taskHasAncestorId(tree, taskId, NORMALIZATION_ISOLATED_WORKTREE_ROOT);
}

function isFixForwardTask(task: TaskNode): boolean {
  return taskContextString(task, "workflow") === "fix-forward";
}

function isCompactFixForwardTask(task: TaskNode): boolean {
  const context = taskContext(task);
  return (
    isFixForwardTask(task) &&
    (context.featureCompactFollowup === true ||
      context.featureCompactFocusedDiagnostic === true ||
      context.featureCompactFocusedSpec === true ||
      textValue(context.subjectKind).includes("compact"))
  );
}

function hasTerminalPipelineWaitReview(task: TaskNode): boolean {
  const context = taskContext(task);
  const trace = taskTrace(task);
  return Boolean(
    recordValue(context.terminalPipelineWaitReview) ||
    recordValue(context.terminalGitHubWaitReview) ||
    textValue(trace.terminal_pipeline_wait_run_id) ||
    textValue(trace.terminal_github_wait_run_id),
  );
}

function currentAttemptId(task: TaskNode): string {
  const value = taskTrace(task).current_attempt_id;
  return typeof value === "string" ? value : "";
}

function completionTaskRevision(
  trigger: ReturnType<typeof parseTriggerEvent>,
): number {
  const value =
    triggerValue(trigger, "taskRevision") ??
    triggerValue(trigger, "task_revision");
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function reviewedEvents(value: unknown): ReviewedEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const event = recordValue(item);
    const type = textValue(event?.type);
    const data = recordValue(event?.data);
    if (!type || !data) return [];
    const owner = textValue(event?.owner);
    const target = recordValue(event?.target);

    if (type === "project.task.completed") {
      const project = textValue(data.project) || textValue(target?.project);
      const taskId =
        textValue(data.taskId) ||
        textValue(data.task_id) ||
        textValue(target?.taskId);
      if (!project || !taskId) return [];
      const normalizedTarget = {
        ...(target ?? {}),
        project,
        taskId,
      };
      return [
        {
          type,
          ...(owner ? { owner } : {}),
          target: normalizedTarget,
          data: {
            ...data,
            project,
            taskId,
            task_id: taskId,
            target: normalizedTarget,
          },
        },
      ];
    }

    return [
      {
        type,
        ...(owner ? { owner } : {}),
        ...(target ? { target } : {}),
        data,
      },
    ];
  });
}

function normalizeDecision(value: unknown): ReviewDecision {
  return value === "accept" ||
    value === "redo" ||
    value === "followup" ||
    value === "blocked" ||
    value === "escalate"
    ? value
    : "escalate";
}

function normalizeConfidence(value: unknown): ReviewConfidence {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "low";
}

function matchingJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseReviewJson(text: string): Record<string, unknown> | null {
  const marker = text.search(/TASK_REVIEW_JSON/i);
  const scoped = marker >= 0 ? text.slice(marker) : text;
  const fenced = scoped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1]) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      // Fall through to brace matching.
    }
  }

  const firstBrace = scoped.indexOf("{");
  if (firstBrace < 0) return null;
  const objectText = matchingJsonObject(scoped, firstBrace);
  if (!objectText) return null;
  try {
    const parsed = JSON.parse(objectText) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function malformedReviewFallback(text: string): StructuredReview {
  const feedback = [text.slice(0, 1800)];
  const guardBlocked = /Workflow blocked by guard:/i.test(text);
  const noSecretLeak = /no-secret-leak|Secret leak detected/i.test(text);

  if (guardBlocked && noSecretLeak) {
    return {
      decision: "escalate",
      confidence: "low",
      summary:
        "Task reviewer was halted by the no-secret-leak guard; planner should route a bounded app-ops manual reconciliation from the existing worker evidence.",
      findings: [
        "reviewer-output-not-structured",
        "reviewer-guard-no-secret-leak",
      ],
      feedback,
      suggestedFollowups: [
        "App-ops should inspect the existing worker evidence, accept or reject the reviewed task, or create one exact successor without duplicating passive blocked waits.",
      ],
      artifacts: [],
      verification: [],
      events: [],
      reviewAction: {
        actionKind: "app-state-repair",
        owner: "app-ops",
        parentId: "project",
        goal: "Manually reconcile the guarded review from the existing worker evidence and either accept it, reject it, or create one exact successor without duplicating passive waits.",
      },
    };
  }

  return {
    decision: "escalate",
    confidence: "low",
    summary:
      "Task reviewer did not emit valid TASK_REVIEW_JSON; planner must inspect completion manually.",
    findings: ["reviewer-output-not-structured"],
    feedback,
    suggestedFollowups: [],
    artifacts: [],
    verification: [],
    events: [],
  };
}

function structuredReviewFromText(text: string): StructuredReview {
  const parsed = parseReviewJson(text);
  if (!parsed) {
    return malformedReviewFallback(text);
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "Reviewer emitted a structured task decision.";
  return {
    decision: normalizeDecision(parsed.decision),
    confidence: normalizeConfidence(parsed.confidence),
    summary,
    findings: stringList(parsed.findings),
    feedback: stringList(parsed.feedback),
    suggestedFollowups: stringList(parsed.suggestedFollowups),
    artifacts: stringList(parsed.artifacts),
    verification: stringList(parsed.verification),
    events: reviewedEvents(parsed.events),
    reviewAction:
      recordValue(parsed.reviewAction) ??
      recordValue(parsed.review_action) ??
      (textValue(parsed.actionKind)
        ? { actionKind: parsed.actionKind }
        : undefined),
  };
}

function emptyValidationNotes(): ReviewValidationNotes {
  return { findings: [], feedback: [], suggestedFollowups: [] };
}

function mergeValidationNotes(
  base: ReviewValidationNotes,
  patch: Partial<ReviewValidationNotes>,
): ReviewValidationNotes {
  return {
    findings: [...base.findings, ...(patch.findings ?? [])],
    feedback: [...base.feedback, ...(patch.feedback ?? [])],
    suggestedFollowups: [
      ...base.suggestedFollowups,
      ...(patch.suggestedFollowups ?? []),
    ],
  };
}

function appendValidationNotesToReview(
  review: StructuredReview,
  notes: ReviewValidationNotes,
): StructuredReview {
  if (
    notes.findings.length === 0 &&
    notes.feedback.length === 0 &&
    notes.suggestedFollowups.length === 0
  ) {
    return review;
  }
  return {
    ...review,
    findings: [...review.findings, ...notes.findings],
    feedback: [...review.feedback, ...notes.feedback],
    suggestedFollowups: [
      ...review.suggestedFollowups,
      ...notes.suggestedFollowups,
    ],
  };
}

function completeReviewCorrectionContract(
  task: TaskNode,
  review: StructuredReview,
): StructuredReview {
  return {
    ...review,
    artifacts:
      review.artifacts.length > 0 ? review.artifacts : stringList(task.outputs),
    verification:
      review.verification.length > 0
        ? review.verification
        : stringList(task.acceptance),
  };
}

function missingEvidenceValidationNotes(input: {
  appDir: string;
  projectDir: string;
  completion: Record<string, unknown>;
}): ReviewValidationNotes {
  const missing = missingDurableEvidenceMemos(input);
  if (missing.length === 0) return emptyValidationNotes();

  return {
    findings: [
      "validation-note:worker-cited-missing-durable-evidence",
      ...missing.map((ref) => `missing:${ref}`),
    ],
    feedback: [
      "Worker completion cited durable evidence memo(s) that do not exist in the app or domain repo. The reviewer should account for this before accepting the task as done.",
    ],
    suggestedFollowups: [],
  };
}

function completionSummary(completion: Record<string, unknown>): string {
  for (const key of ["summary", "message", "result"]) {
    const value = completion[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function evidenceRefs(completion: Record<string, unknown>): string[] {
  const workflowResult =
    recordValue(completion.workflowResult) ??
    recordValue(completion.workflow_result);
  return stringList(completion.evidenceRefs).concat(
    stringList(completion.evidence_refs),
    stringList(workflowResult?.artifacts),
  );
}

function isDurableEvidenceMemo(ref: string): boolean {
  return /(?:^|\/)evidence\/archive\/[^/\s]+\.md$/i.test(ref);
}

function localEvidenceExists(
  ref: string,
  input: { appDir: string; projectDir: string },
): boolean {
  if (isAbsolute(ref)) return existsSync(ref);
  return (
    existsSync(join(input.appDir, ref)) ||
    existsSync(join(input.projectDir, ref))
  );
}

function missingDurableEvidenceMemos(input: {
  appDir: string;
  projectDir: string;
  completion: Record<string, unknown>;
}): string[] {
  return [...new Set(evidenceRefs(input.completion))]
    .filter(isDurableEvidenceMemo)
    .filter((ref) => !localEvidenceExists(ref, input));
}

function workflowResultDetails(
  completion: Record<string, unknown>,
): Record<string, unknown> {
  const workflowResult =
    recordValue(completion.workflowResult) ??
    recordValue(completion.workflow_result);
  return recordValue(workflowResult?.details) ?? {};
}

function textValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function queuedRunDetails(
  completion: Record<string, unknown>,
): Record<string, unknown> | null {
  const details = workflowResultDetails(completion);
  return (
    recordValue(details.queuedRun) ??
    recordValue(details.queuedPipelineRun) ??
    recordValue(details.acceptedQueuedPipelineRun)
  );
}

function specIdRoots(specId: string): string[] {
  const normalized = specId.startsWith("spec.") ? specId.slice(5) : specId;
  const root = normalized.split(".")[0]?.trim();
  return root ? [root] : [];
}

function featureRootsFromPaths(paths: string[]): string[] {
  const roots = new Set<string>();
  for (const path of paths) {
    const match = path.match(/(?:^|\/)features\/([^/]+)\//);
    if (match?.[1]) roots.add(match[1]);
  }
  return [...roots].sort((left, right) => left.localeCompare(right));
}

function expectedNormalizationFeatureRoots(task: TaskNode): string[] {
  const roots = new Set<string>();
  for (const scope of stringList(task.conflict_scope)) {
    if (!scope.startsWith("spec:")) continue;
    for (const root of specIdRoots(scope.slice("spec:".length).trim())) {
      roots.add(root);
    }
  }
  for (const input of stringList(task.inputs)) {
    const trimmed = input.trim();
    if (!trimmed.startsWith("spec:")) continue;
    for (const root of specIdRoots(trimmed.slice("spec:".length).trim())) {
      roots.add(root);
    }
  }
  for (const root of featureRootsFromPaths(stringList(task.outputs))) {
    roots.add(root);
  }
  return [...roots].sort((left, right) => left.localeCompare(right));
}

function changedFileFeatureRoots(changedFiles: string[]): string[] {
  const roots = new Set<string>();
  for (const file of changedFiles) {
    const match = file.match(/^features\/([^/]+)\//);
    if (match?.[1]) roots.add(match[1]);
  }
  return [...roots].sort((left, right) => left.localeCompare(right));
}

function normalizationQueuedRunValidationNotes(input: {
  task: TaskNode;
  completion: Record<string, unknown>;
}): ReviewValidationNotes {
  const queuedRun = queuedRunDetails(input.completion);
  if (!queuedRun) return emptyValidationNotes();

  const findings: string[] = [];
  const feedback: string[] = [];
  const runId = textValue(queuedRun.runId) || textValue(queuedRun.run_id);
  const baseRef = textValue(queuedRun.baseRef) || textValue(queuedRun.base_ref);
  const baseCommit =
    textValue(queuedRun.baseCommit) || textValue(queuedRun.base_commit);
  const sourceVersion =
    textValue(queuedRun.sourceVersion) || textValue(queuedRun.source_version);
  const sourceCommit =
    textValue(queuedRun.sourceCommit) || textValue(queuedRun.source_commit);
  const firstParentCommits = stringList(
    queuedRun.firstParentCommits ?? queuedRun.first_parent_commits,
  );
  const changedFiles = stringList(
    queuedRun.changedFiles ?? queuedRun.changed_files,
  );
  const worktreePath =
    textValue(queuedRun.worktreePath) || textValue(queuedRun.worktree_path);

  if (baseRef !== "origin/dev") {
    findings.push("normalization-isolation-base-ref-not-origin-dev");
    findings.push(`baseRef:${baseRef || "missing"}`);
  }
  if (!baseCommit) findings.push("normalization-isolation-base-commit-missing");
  if (!sourceVersion) {
    findings.push("normalization-isolation-source-version-missing");
  }
  if (!sourceCommit) {
    findings.push("normalization-isolation-source-commit-missing");
  }
  if (sourceVersion && sourceCommit && sourceVersion !== sourceCommit) {
    findings.push("normalization-isolation-source-version-mismatch");
    findings.push(`sourceVersion:${sourceVersion}`);
    findings.push(`sourceCommit:${sourceCommit}`);
  }
  if (firstParentCommits.length === 0) {
    findings.push("normalization-isolation-first-parent-commits-missing");
  } else if (
    sourceCommit &&
    firstParentCommits[firstParentCommits.length - 1] !== sourceCommit
  ) {
    findings.push("normalization-isolation-first-parent-tail-mismatch");
    findings.push(
      `firstParentTail:${firstParentCommits[firstParentCommits.length - 1]}`,
    );
  }
  if (changedFiles.length === 0) {
    findings.push("normalization-isolation-changed-files-missing");
  }
  if (!worktreePath) {
    findings.push("normalization-isolation-worktree-path-missing");
  }

  const expectedRoots = expectedNormalizationFeatureRoots(input.task);
  const changedRoots = changedFileFeatureRoots(changedFiles);
  const unexpectedRoots = changedRoots.filter(
    (root) => expectedRoots.length > 0 && !expectedRoots.includes(root),
  );
  if (unexpectedRoots.length > 0) {
    findings.push("normalization-isolation-unexpected-feature-root");
    findings.push(`expectedFeatures:${expectedRoots.join(",") || "missing"}`);
    for (const root of unexpectedRoots) {
      findings.push(`unexpectedFeature:${root}`);
    }
  }

  if (findings.length === 0) {
    return {
      findings: [
        "validation-note:normalization-isolated-worktree-lineage-present",
        ...(runId ? [`run:${runId}`] : []),
        ...(baseCommit ? [`baseCommit:${baseCommit}`] : []),
        ...(sourceCommit ? [`sourceCommit:${sourceCommit}`] : []),
        `changedFiles:${changedFiles.length}`,
      ],
      feedback: [],
      suggestedFollowups: [],
    };
  }

  feedback.push(
    "Redo the normalization dispatch from a task-specific isolated worktree based on current origin/dev and return QUEUED_PIPELINE_RUN with baseRef/baseCommit/sourceCommit/firstParentCommits/changedFiles/worktreePath proving the queued sourceVersion is the reviewed isolated commit only.",
  );
  return {
    findings: [
      "normalization-isolation-contract-invalid",
      ...(runId ? [`run:${runId}`] : []),
      ...findings,
    ],
    feedback,
    suggestedFollowups: [],
  };
}

function normalizationIsolationHardFailure(review: StructuredReview): boolean {
  return review.findings.some(
    (finding) =>
      finding === "normalization-isolation-contract-invalid" ||
      finding.startsWith("normalization-isolation-"),
  );
}

function enforceNormalizationIsolationDecision(
  review: StructuredReview,
): StructuredReview {
  if (
    review.decision !== "accept" ||
    !normalizationIsolationHardFailure(review)
  ) {
    return review;
  }
  return {
    ...review,
    decision: "redo",
    confidence: "high",
    summary:
      "Normalization queued run is missing isolated-worktree lineage proof or still points at mixed ancestry, so the worker result cannot be accepted.",
    feedback: [
      ...review.feedback,
      "Reject this normalization queued-run result until the worker proves an origin/dev-based isolated worktree, matching sourceVersion/sourceCommit, ordered first-parent commits, and in-scope changed files.",
    ],
  };
}

function featureScenarioCarrierValidationNotes(input: {
  projectDir: string;
  task: TaskNode;
}): ReviewValidationNotes {
  const violations = featureScenarioCarrierViolationsForTaskOutputs({
    projectDir: input.projectDir,
    outputPaths: stringList(input.task.outputs),
  });
  if (violations.length === 0) return emptyValidationNotes();

  return {
    findings: violations.flatMap((violation) => [
      violation.code,
      `scenario:${violation.scenarioBase}`,
      ...violation.files.map((file) => `file:${file}`),
    ]),
    feedback: [
      ...violations.map((violation) => violation.summary),
      "Redo the feature authoring so one direct feature-owned .test.ts file carries the scenario, controller-visible spec/model/coverage surfaces point only at that .test.ts path, and any plain .ts helpers remain non-scenario support modules.",
    ],
    suggestedFollowups: [],
  };
}

function featureScenarioCarrierHardFailure(review: StructuredReview): boolean {
  return review.findings.some((finding) =>
    finding.startsWith("feature-scenario-carrier-"),
  );
}

function enforceFeatureScenarioCarrierDecision(
  review: StructuredReview,
): StructuredReview {
  if (
    !featureScenarioCarrierHardFailure(review) ||
    review.decision === "redo"
  ) {
    return review;
  }
  return {
    ...review,
    decision: "redo",
    confidence: "high",
    summary:
      "Feature scenario authoring output still introduces or preserves a plain scenario carrier instead of one direct .test.ts owner.",
    feedback: [
      ...review.feedback,
      "Reject this result until the worker removes the plain scenario carrier, stops wrapper-only .test.ts launchers, and keeps maintained references on the direct .test.ts path only.",
    ],
  };
}

function fixForwardMissingFields(
  completion: Record<string, unknown>,
): string[] {
  const details = workflowResultDetails(completion);
  const fixForward = recordValue(details.fixForward);
  if (!fixForward) return ["workflowResult.details.fixForward"];

  const missing: string[] = [];
  if (textValue(fixForward.workflow) !== "fix-forward") {
    missing.push("fixForward.workflow");
  }
  if (!recordValue(fixForward.subject)) missing.push("fixForward.subject");
  if (!textValue(fixForward.classification)) {
    missing.push("fixForward.classification");
  }
  if (!textValue(fixForward.diagnosis)) missing.push("fixForward.diagnosis");
  if (!recordValue(fixForward.minimumDiagnosisPacket)) {
    missing.push("fixForward.minimumDiagnosisPacket");
  }
  if (!recordValue(fixForward.verification)) {
    missing.push("fixForward.verification");
  }
  if (!textValue(fixForward.nextAction)) {
    missing.push("fixForward.nextAction");
  }
  if (!textValue(fixForward.nextActionReason)) {
    missing.push("fixForward.nextActionReason");
  }
  return missing;
}

function repeatedFixForwardStructuredResultMiss(task: TaskNode): boolean {
  const reason = textValue(taskTrace(task).review_reject_reason).toLowerCase();
  return (
    reason.includes("fix_forward_result") ||
    reason.includes("fix-forward completion is missing") ||
    reason.includes("structured diagnosis fields")
  );
}

function fixForwardDetails(
  completion: Record<string, unknown>,
): Record<string, unknown> | null {
  return recordValue(workflowResultDetails(completion).fixForward);
}

function fixForwardCompactFreshnessFindings(input: {
  task: TaskNode;
  completion: Record<string, unknown>;
}): string[] {
  if (!isCompactFixForwardTask(input.task)) return [];
  const fixForward = fixForwardDetails(input.completion);
  if (!fixForward) return [];
  const nextAction = textValue(fixForward.nextAction);
  if (nextAction !== "done" && nextAction !== "exact-wait") return [];

  const verification = recordValue(fixForward.verification);
  const minimumDiagnosisPacket = recordValue(fixForward.minimumDiagnosisPacket);
  const changedFiles = stringList(fixForward.changedFiles);
  const paths = [
    ...evidenceRefs(input.completion),
    ...changedFiles,
    textValue(verification?.resultPath),
    textValue(minimumDiagnosisPacket?.resultPath),
  ].filter(Boolean);
  const trace = taskTrace(input.task);
  const attemptId = textValue(trace.current_attempt_id);
  const attemptDate = attemptId.match(/\b(20\d{6})\d{0,6}\b/)?.[1] ?? "";
  const hasCurrentAttemptPath =
    Boolean(attemptId) && paths.some((path) => path.includes(attemptId));
  const hasCurrentDatePath =
    Boolean(attemptDate) && paths.some((path) => path.includes(attemptDate));
  const explanation = [
    textValue(fixForward.evidenceFreshness),
    textValue(verification?.evidenceFreshness),
    textValue(minimumDiagnosisPacket?.evidenceFreshness),
  ]
    .join(" ")
    .toLowerCase();
  const explicitlyReusesExactEvidence = explanation
    .split(/\s+/)
    .includes("reused-exact");

  if (
    hasCurrentAttemptPath ||
    hasCurrentDatePath ||
    explicitlyReusesExactEvidence
  ) {
    return [];
  }
  return [
    "compact-fix-forward-evidence-not-fresh",
    `attempt:${attemptId || "missing"}`,
    `paths:${paths.join(", ") || "none"}`,
  ];
}

function fixForwardBackendMismatchFindings(input: {
  task: TaskNode;
  completion: Record<string, unknown>;
}): string[] {
  if (!isFixForwardTask(input.task)) return [];
  const context = taskContext(input.task);
  if (textValue(context.currentBackend).toLowerCase() !== "ado") return [];

  const fixForward = fixForwardDetails(input.completion);
  if (!fixForward) return [];

  const verification = recordValue(fixForward.verification);
  const minimumDiagnosisPacket = recordValue(fixForward.minimumDiagnosisPacket);
  const currentRunBackends = [
    textValue(fixForward.currentRunBackend),
    textValue(fixForward.executionBackend),
    textValue(verification?.backend),
    textValue(verification?.executionBackend),
    textValue(minimumDiagnosisPacket?.backend),
    textValue(minimumDiagnosisPacket?.executionBackend),
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  const usesGitHubAsCurrentBackend = currentRunBackends.some(
    (backend) =>
      backend === "github" ||
      backend === "github-actions" ||
      backend === "github workflow",
  );
  if (!usesGitHubAsCurrentBackend) return [];

  return [
    "fix-forward-current-backend-ado-but-structured-result-names-github-backend",
    `nextAction:${textValue(fixForward.nextAction) || "missing"}`,
    `currentRunBackends:${currentRunBackends.join(",") || "missing"}`,
    `verificationRunId:${textValue(verification?.runId) || "missing"}`,
  ];
}

function completedSpecVerification(
  completion: Record<string, unknown>,
): Record<string, unknown> | null {
  const workflowResult =
    recordValue(completion.workflowResult) ??
    recordValue(completion.workflow_result);
  const workflow = textValue(workflowResult?.workflow);
  if (
    workflow !== "single-spec-verifier" &&
    workflow !== "spec-result-review"
  ) {
    return null;
  }
  const details = recordValue(workflowResult?.details);
  if (!details) return null;
  return {
    ...details,
    status: workflowResult.status,
    subject: workflowResult.subject,
    artifacts: workflowResult.artifacts,
  };
}

function completedSpecVerificationResults(
  completion: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const verification = completedSpecVerification(completion);
  if (!verification) return [];
  const runId = textValue(verification.runId);
  const runUrl = textValue(verification.runUrl);
  const aggregateResultPath = textValue(verification.resultPath);
  const aggregateLiveVerified = verification.liveVerified === true;
  const aggregateLiveClusterObserved =
    verification.liveClusterObserved === true || aggregateLiveVerified;
  const aggregateResourceGroup = textValue(verification.resourceGroup);
  const aggregateClusterName = textValue(verification.clusterName);
  const subject = recordValue(verification.subject);
  const rawSpecResults = Array.isArray(verification.specResults)
    ? verification.specResults
    : [];

  if (rawSpecResults.length === 0) {
    return [
      {
        ...verification,
        specId: textValue(subject?.id) || textValue(verification.specId),
        specStatus: textValue(verification.specStatus),
        liveVerified: aggregateLiveVerified,
        liveClusterObserved: aggregateLiveClusterObserved,
        resourceGroup: aggregateResourceGroup,
        clusterName: aggregateClusterName,
      },
    ];
  }

  return rawSpecResults
    .map((entry) => recordValue(entry))
    .filter((entry): entry is Record<string, unknown> => !!entry)
    .map((entry) => {
      const artifactRefs = stringList(entry.artifactRefs);
      const resultPath =
        textValue(entry.resultPath) ||
        artifactRefs.find((ref) => /result\.json$/i.test(ref)) ||
        aggregateResultPath;
      return {
        ...entry,
        runId: textValue(entry.runId) || runId,
        runUrl: textValue(entry.runUrl) || runUrl,
        resultPath,
        specStatus: textValue(entry.specStatus) || textValue(entry.status),
        reason: textValue(entry.reason) || textValue(verification.reason),
        liveVerified:
          entry.liveVerified === true ||
          (aggregateLiveVerified &&
            (textValue(entry.specStatus) || textValue(entry.status)) ===
              "pass"),
        liveClusterObserved:
          entry.liveClusterObserved === true || aggregateLiveClusterObserved,
        resourceGroup: textValue(entry.resourceGroup) || aggregateResourceGroup,
        clusterName: textValue(entry.clusterName) || aggregateClusterName,
      };
    });
}

function terminalPipelineWaitExpectedSpecIds(task: TaskNode): string[] {
  const context = taskContext(task);
  const review =
    recordValue(context.terminalPipelineWaitReview) ??
    recordValue(context.terminalGitHubWaitReview);
  const expected = [
    ...stringList(review?.specIds),
    ...stringList(review?.namedSpecIds),
  ].filter(Boolean);
  return [...new Set(expected)];
}

function looksExactArtifactPath(path: string): boolean {
  return (
    Boolean(path) &&
    !path.endsWith("/") &&
    /(^|\/)[^/]+\.[A-Za-z0-9]+$/i.test(path)
  );
}

function terminalPipelineStructuredResultIssues(
  task: TaskNode,
  completion: Record<string, unknown>,
): { findings: string[]; feedback: string[] } | null {
  if (!hasTerminalPipelineWaitReview(task)) return null;
  const verification = completedSpecVerification(completion);
  if (!verification) return null;

  const findings: string[] = [];
  const feedback: string[] = [];
  const aggregateResultPath = textValue(verification.resultPath);
  const expectedSpecIds = terminalPipelineWaitExpectedSpecIds(task);
  const rawSpecResults = Array.isArray(verification.specResults)
    ? verification.specResults
    : [];

  if (!looksExactArtifactPath(aggregateResultPath)) {
    findings.push(
      "terminal-pipeline-aggregate-result-path-missing-or-not-exact",
    );
  }

  if (expectedSpecIds.length > 1) {
    if (rawSpecResults.length === 0) {
      findings.push("terminal-pipeline-per-spec-results-missing");
    }

    const entries = rawSpecResults
      .map((entry) => recordValue(entry))
      .filter((entry): entry is Record<string, unknown> => !!entry);

    for (const expectedSpecId of expectedSpecIds) {
      const match = entries.find(
        (entry) => textValue(entry.specId) === expectedSpecId,
      );
      if (!match) {
        findings.push(
          `terminal-pipeline-missing-spec-result:${expectedSpecId}`,
        );
        continue;
      }
      const artifactRefs = stringList(match.artifactRefs);
      const exactResultPath =
        textValue(match.resultPath) ||
        artifactRefs.find((ref) => looksExactArtifactPath(ref));
      const specStatus = textValue(match.specStatus) || textValue(match.status);
      if (!textValue(match.runId)) {
        findings.push(`terminal-pipeline-missing-run-id:${expectedSpecId}`);
      }
      if (!looksExactArtifactPath(exactResultPath)) {
        findings.push(
          `terminal-pipeline-missing-result-path:${expectedSpecId}`,
        );
      }
      if (
        specStatus !== "pass" &&
        specStatus !== "fail" &&
        specStatus !== "error"
      ) {
        findings.push(`terminal-pipeline-missing-status:${expectedSpecId}`);
      }
      if (!textValue(match.reason)) {
        findings.push(`terminal-pipeline-missing-reason:${expectedSpecId}`);
      }
      if (artifactRefs.length === 0) {
        findings.push(
          `terminal-pipeline-missing-artifact-refs:${expectedSpecId}`,
        );
      }
    }
  }

  if (findings.length === 0) return null;

  feedback.push(
    "Redo the task and return SPEC_RESULT_REVIEW with the exact aggregate result path plus one per-spec entry for every named spec containing specId, runId, resultPath, specStatus, reason, live proof fields, and artifactRefs.",
  );
  return { findings, feedback };
}

function validationNotesForCompletion(
  task: TaskNode,
  completion: Record<string, unknown>,
  input: {
    normalizationIsolatedWorktreeRequired?: boolean;
  } = {},
): ReviewValidationNotes {
  let notes = emptyValidationNotes();
  const summary = completionSummary(completion);
  const evidence = evidenceRefs(completion);
  const specVerificationResults = completedSpecVerificationResults(completion);
  const terminalPipelineIssues = terminalPipelineStructuredResultIssues(
    task,
    completion,
  );
  if (terminalPipelineIssues) {
    const firstResult = specVerificationResults[0] ?? {};
    return mergeValidationNotes(notes, {
      findings: [
        "validation-note:structured-spec-verification-result-incomplete",
        ...terminalPipelineIssues.findings,
        `run:${textValue(firstResult.runId) || "missing"}`,
        `result:${textValue(firstResult.resultPath) || "missing"}`,
        `status:${textValue(firstResult.specStatus) || "missing"}`,
        `liveVerified:${String(firstResult.liveVerified === true)}`,
      ],
      feedback: [
        ...terminalPipelineIssues.feedback,
        "Structured spec data did not prove a same-spec live AKS verdict. Review the exact run artifact and require a result path, run id, same-spec status, and live proof for any pass verdict.",
      ],
      suggestedFollowups: [],
    });
  }
  if (specVerificationResults.length) {
    const validResults = specVerificationResults.filter((result) => {
      const specStatus = textValue(result.specStatus);
      const liveVerified = result.liveVerified === true;
      return (
        textValue(result.resultPath) &&
        textValue(result.runId) &&
        (specStatus === "pass" ||
          specStatus === "fail" ||
          specStatus === "error") &&
        (specStatus !== "pass" || liveVerified)
      );
    });
    if (validResults.length === specVerificationResults.length) {
      const statuses = validResults.map((result) =>
        textValue(result.specStatus),
      );
      const runIds = [
        ...new Set(validResults.map((result) => textValue(result.runId))),
      ];
      const resultPaths = validResults.map((result) =>
        textValue(result.resultPath),
      );
      notes = mergeValidationNotes(notes, {
        findings: [
          "validation-note:structured-spec-verification-result-present",
          ...runIds.map((runId) => `run:${runId}`),
          ...resultPaths.map((resultPath) => `result:${resultPath}`),
          ...[...new Set(statuses)].map((status) => `status:${status}`),
          ...(validResults.length > 1
            ? validResults.map(
                (result) =>
                  `spec:${textValue(result.specId) || textValue(result.id) || "unknown"}:${textValue(result.specStatus)}`,
              )
            : []),
          ...validResults.map(
            (result) =>
              `liveClusterObserved:${String(result.liveClusterObserved === true)}`,
          ),
          ...validResults
            .map((result) => `resourceGroup:${textValue(result.resourceGroup)}`)
            .filter((item) => !item.endsWith(":")),
          ...validResults
            .map((result) => `clusterName:${textValue(result.clusterName)}`)
            .filter((item) => !item.endsWith(":")),
        ],
      });
      return notes;
    }
    const firstResult = specVerificationResults[0] ?? {};
    return mergeValidationNotes(notes, {
      findings: [
        "validation-note:structured-spec-verification-result-incomplete",
        `run:${textValue(firstResult.runId) || "missing"}`,
        `result:${textValue(firstResult.resultPath) || "missing"}`,
        `status:${textValue(firstResult.specStatus) || "missing"}`,
        `liveVerified:${String(firstResult.liveVerified === true)}`,
      ],
      feedback: [
        "Structured spec data did not prove a same-spec live AKS verdict. Review the exact run artifact and require a result path, run id, same-spec status, and live proof for any pass verdict.",
      ],
      suggestedFollowups: [],
    });
  }
  if (summary === EMPTY_ASSISTANT_TURN && evidence.length === 0) {
    notes = mergeValidationNotes(notes, {
      findings: ["worker-empty-assistant-turn", "worker-no-evidence"],
      feedback: [
        "Worker attempt produced an empty assistant turn and no evidence. The reviewer should not accept this without concrete evidence, a repo-local change, or an exact external wait with owner and resume condition.",
      ],
    });
  }
  if (hasTerminalPipelineWaitReview(task)) {
    notes = mergeValidationNotes(notes, {
      findings: [
        "terminal-pipeline-wait-structured-result-missing",
        `evidenceRefs:${evidence.length}`,
      ],
      feedback: [
        "Terminal pipeline wait review needs structured same-spec live result data. The reviewer should require workflowResult.details with run id, exact aggregate result path, per-spec specId/runId/resultPath/specStatus/reason/artifactRefs fields, and live proof for pass verdicts.",
      ],
    });
  }
  if (isFixForwardTask(task)) {
    const missing = fixForwardMissingFields(completion);
    if (missing.length > 0) {
      if (repeatedFixForwardStructuredResultMiss(task)) {
        return mergeValidationNotes(notes, {
          findings: [
            "fix-forward-structured-result-missing-repeated",
            ...missing.map((field) => `missing:${field}`),
          ],
          feedback: [
            "Stop retrying the same domain task unchanged. Repair the worker prompt/adapter or workflow route so completed fix-forward tasks emit FIX_FORWARD_RESULT in workflowResult.details.fixForward.",
          ],
          suggestedFollowups: [
            "Create an ops repair for the fix-forward worker structured-result contract.",
          ],
        });
      }
      return mergeValidationNotes(notes, {
        findings: [
          "fix-forward-structured-result-missing",
          ...missing.map((field) => `missing:${field}`),
        ],
        feedback: [
          "Redo the task and finish with FIX_FORWARD_RESULT containing subject, classification, diagnosis, minimumDiagnosisPacket, verification, nextAction, and nextActionReason.",
        ],
        suggestedFollowups: [],
      });
    }
    const staleEvidenceFindings = fixForwardCompactFreshnessFindings({
      task,
      completion,
    });
    if (staleEvidenceFindings.length > 0) {
      return mergeValidationNotes(notes, {
        findings: staleEvidenceFindings,
        feedback: [
          "Redo the task with a fresh attempt evidence path, or set FIX_FORWARD_RESULT.evidenceFreshness/verification.evidenceFreshness/minimumDiagnosisPacket.evidenceFreshness to reused-exact when prior evidence is intentionally reused.",
        ],
        suggestedFollowups: [],
      });
    }
    const backendMismatchFindings = fixForwardBackendMismatchFindings({
      task,
      completion,
    });
    if (backendMismatchFindings.length > 0) {
      return mergeValidationNotes(notes, {
        findings: backendMismatchFindings,
        feedback: [
          "Redo the task against current backend facts. For ADO work, structured current backend fields must not name GitHub as the current execution backend.",
        ],
        suggestedFollowups: [],
      });
    }
  }
  if (input.normalizationIsolatedWorktreeRequired) {
    notes = mergeValidationNotes(
      notes,
      normalizationQueuedRunValidationNotes({ task, completion }),
    );
  }
  return notes;
}

function reviewerSessionId(taskId: string, attemptId: string): string {
  const safeTask = taskId.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 48);
  const safeAttempt = attemptId.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  const digest = createHash("sha1")
    .update(`${taskId}::${attemptId}`)
    .digest("hex")
    .slice(0, 12);
  return `s_task_review_${safeTask}_${safeAttempt}_${digest}`;
}

function buildReviewPrompt(input: {
  appDir: string;
  projectDir: string;
  task: TaskNode;
  completion: Record<string, unknown>;
  validationNotes: ReviewValidationNotes;
  trigger: string;
  normalizationIsolatedWorktreeRequired?: boolean;
}): string {
  return `Task Review Mode

You are the read-only independent reviewer for one completed aks-rp-e2e task.
Judge whether the worker completion satisfies the task acceptance criteria.

Boundaries:
- Do not mutate the task tree, loop state, project files, or domain files.
- Do not assign tasks, create follow-up tasks, mark tasks done, or run live AKS
  tests.
- Review only this completed task, its acceptance criteria, worker result,
  evidence refs, and immediately relevant artifacts/files.
- The planner is the only workflow that applies your judgment to the task tree.
- The live task tree is runtime state. Use the task record in this prompt or
  supported app commands such as \`bun run task-tree show <task-id>\` to inspect
  it. Do not treat checked-in \`tasks/tree.json\` as the live task tree; it can
  be a stale legacy/bootstrap snapshot. Current runtime task state lives under
  \`.state/tasks/tree.json\` behind the task-tree helpers.

Decision meanings:
- accept: evidence satisfies the task acceptance criteria.
- redo: same task should be rejected/retried with feedback.
- followup: current work is useful but needs a concrete successor.
- blocked: a real external/environment/product wait remains.
- escalate: owner/human judgment is required before deciding.

Code-collected validation notes:
\`\`\`json
${JSON.stringify(input.validationNotes, null, 2)}
\`\`\`

Use these notes as facts and guardrails, not as a pre-made decision. If a note
names a hard missing structured field or missing evidence path, account for it
in your decision and feedback. Do not ignore validation notes, but you remain
responsible for the final review judgment.

For metric, watchdog, blocked-frontier, and overdue-wait audit tasks, verify
that the worker measured the baseline as if the audited task itself did not
exist. Do not accept an audit that concludes "few/no contributors remain" only
because the audit task's own goal text, conflict scope, active state, or review
state references and suppresses the blocked waits under inspection.

For overdue-wait audit tasks that name a blocked wait, do not accept a memo by
itself. Accept only when the completion proves the named wait was refreshed with
current evidence and future next/fallback times, replaced by a narrower exact
wait, unblocked/closed, escalated, or covered by a still-open active/review
handoff. If the worker only says "the planner should refresh it", choose
followup or redo.

For fix-forward tasks, do not infer success from prose. Accept only when the
completion includes structured fix-forward details with subject,
classification, diagnosis, minimumDiagnosisPacket, verification, nextAction,
and nextActionReason. If the worker reported a tool, agent, pipeline, provider,
or artifact failure, review that as workflow/process failure, not AKS product
proof.

${
  input.normalizationIsolatedWorktreeRequired
    ? `For tasks under ${NORMALIZATION_ISOLATED_WORKTREE_ROOT}, reject any queued
normalization rerun that does not prove an isolated origin/dev-based worktree
through structured QUEUED_PIPELINE_RUN lineage. Accept queued normalization runs
only when the structured result includes baseRef=origin/dev, baseCommit,
sourceCommit, sourceVersion, ordered firstParentCommits ending at sourceCommit,
and changedFiles/worktreePath for the isolated task worktree. If sourceVersion
!= sourceCommit, if the branch still points at a shared contaminated root
worktree, or if changed files show a different scenario family than the task,
choose redo rather than accept. Observed mixed fixtures such as Preflight
172532763, Disk 172519831, Planned 172519985, and Disable SSH 172519192
should fail this contract; clean isolated lineage examples such as 172513552,
172513872, 172515477, 172517379, and 172518211 should pass it.

For a terminal same-run live pass under this normalization frontier, do not
treat the pass as closure by itself when the exact tested sourceCommit is still
outside current origin/dev. Keep one exact publication successor alive until the
tested commit is proven in origin/dev ancestry with strict inventory decrease.
If merge-conflict resolution changes scenario content, require a replacement
exact-commit live verification instead of accepting an untested publication.
Non-pass/error results stay on fix-forward and never publication.

`
    : ""
}
For feature scenario authoring or normalization tasks, accept only one direct
feature-owned .test.ts scenario carrier per authored scenario. Reject a result
that adds a new plain features/*/tests/*.ts scenario carrier, keeps or creates a
wrapper .test.ts whose only purpose is spawning a sibling plain carrier, or
repoints maintained spec/model/coverage surfaces to a plain scenario carrier.
Ordinary support modules remain allowed when they are not scenario carriers.
Legacy plain carriers may remain as untouched migration inventory, but a worker
must not preserve them as the active authored scenario output for the task.
For scenario-test normalization frontier leaves, do not treat local isolated
worktree normalization as terminal by itself. Accept terminal closure only when
current origin/dev strict inventory moved, or when the task has already produced
an exact queued live run, terminal live-pass publication/recheck successor,
exact blocker, escalation, or other concrete successor. If the worker only
proved local normalization in an isolated worktree, choose followup and require
publication/recheck or the next exact verification step.

For shared runtime repairs, review the cited implementation against the
existing design contract and sibling success paths, not only the new regression
test. Reject a global suppression or classification rule when the task only
proved one stale lineage and the broader rule changes valid behavior. An
intentional no-resume outcome is not a resume failure and must not be recorded
as one; failure events must continue to mean an attempted operation failed.

For terminal Azure DevOps pipeline wait reviews, accept only a real domain
review result. The worker must locate or download the returned run artifacts,
inspect the exact result.json/spec-runner result for the named spec or compact
branch, and cite the exact aggregate result path plus pass/fail/error facts. If
the wait names multiple specs, require one per-spec structured result for each
named spec with specId, runId, resultPath, specStatus, reason, and artifactRefs
(and live proof fields for pass verdicts). Do not accept aggregate-only status,
broad runs/test-results directories, or a completion that merely says the
pipeline is terminal and should be reviewed. The domain worker must not mutate
the task tree or app loop state; it returns evidence/results for the app to
consume.

If the task acceptance asks the worker to recommend an exact task-tree mutation
and the worker satisfies that by returning a recommendation instead of applying
it, choose followup unless the planner/app-ops successor already exists. The
domain worker's recommendation is useful evidence, but the project is not closed
until a concrete owner applies or explicitly rejects that mutation.

If satisfying the task requires a durable event transition, judge the evidence
and return the exact canonical event(s) in \`events\` for the planner to apply.
Do not accept a memo that merely says an event "should" be emitted. For
loop refill, \`project.task.tick\` is allowed only with one of the canonical
actions \`spec-loop\`, \`feature-reference-loop\`, or \`feature-compact-loop\`,
and its target task must be the matching durable loop root. Put \`action\` in
both the event envelope and \`data\` so action selectors route it directly.
The other allowed reviewed event types are \`project.task.completed\`,
\`escalation.resolved\`, and \`escalation.dismissed\`; do not return arbitrary
commands such as task assignment or owner requests in \`events\`. For
escalation lifecycle closure, use only \`escalation.resolved\` or
\`escalation.dismissed\`, include the original \`escalationId\`, route \`owner\` back
to the original source agent, and include a concise evidence-backed summary or
reason. Use \`escalation.dismissed\` when the ask is duplicate, wrong, obsolete,
or no longer needed. Use \`escalation.resolved\` with \`outcome: "superseded"\`
when newer work replaced the ask. Use \`outcome: "fixed"\` or \`"answered"\` only
when the repair or answer satisfies the original resume condition and the
source session should continue. Do not emit events yourself from this read-only
review session.

When the reviewed evidence is sufficient and the exact canonical event in
\`events\` is the only authorized mutation the worker could not perform, choose
\`accept\`; the planner validates and emits accepted reviewed events. Do not
choose \`blocked\` merely because the read-only worker did not emit the event.
If facts must be checked after emission, include a bounded \`reviewAction\` for
that post-transition verification so the planner can emit the event and create
the verification successor in the same apply step.
Only include \`reviewAction\` when an additional planner-owned action is required
after this review. Omit it when the current task should close with no successor;
put optional future ideas in \`suggestedFollowups\` instead. Never emit a
\`reviewAction\` whose goal is to close the current task with no successor.
For a deterministic \`task-tree-followup\` that should create the domain
successor directly, include the complete successor contract: \`idBase\`,
\`parentId\`, \`owner\`, \`goal\`, non-empty \`outputs\`, non-empty
\`acceptance\`, and non-empty \`conflictScopes\`. The owner must remain the
reviewed task owner, and any workflow must remain the reviewed task workflow.
If the successor cannot produce new facts until an external or repo state
changes, keep the same \`task-tree-followup\` contract but include structured
wait fields instead of creating another immediate recheck. Use
\`waitingFor\` for the exact condition, \`blockerOwner\`,
\`resumeCondition\`, \`nextCheckAt\`, \`fallbackAt\`, and \`fallbackAction\`
when known. Example: a publication recheck that is waiting for \`origin/dev\`
to change should use \`waitingFor: { "type": "git.ref.changed", "ref":
"origin/dev", "currentCommit": "..." }\` and a resume condition that says to
resume only after that ref changes or a publication attempt updates the branch.

If those fields cannot be stated exactly, omit the incomplete fields; the
planner will keep that review on the legacy bounded app-ops path.

Finish with exactly one structured block:

TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "accept | redo | followup | blocked | escalate",
  "confidence": "high | medium | low",
  "summary": "one concise review summary",
  "findings": ["specific evidence-backed findings"],
  "feedback": ["actionable retry/rework feedback when not accepting"],
  "suggestedFollowups": ["optional concrete follow-up task ideas"],
  "artifacts": ["files, results, workflows, or state surfaces that must change or be inspected"],
  "verification": ["observable conditions required before accepting the correction"],
  "events": [
    {
      "type": "optional canonical event for the planner to apply",
      "owner": "agent that owns the returned event",
      "data": { "required": "event-specific fields" }
    }
  ],
  "reviewAction": {
    "actionKind": "optional structured planner action such as app-state-repair, publish-domain-repair-and-rerun, create-domain-followup, or task-tree-followup",
    "goal": "optional exact successor goal",
    "idBase": "required exact task id for direct task-tree-followup",
    "parentId": "required existing parent for direct task-tree-followup",
    "owner": "required current task owner for direct task-tree-followup",
    "outputs": ["required outputs for direct task-tree-followup"],
    "acceptance": ["required acceptance for direct task-tree-followup"],
    "conflictScopes": ["required conflict scope for direct task-tree-followup"],
    "waitingFor": { "optional": "structured condition that must change before this successor can run" },
    "blockerCategory": "optional blocker category such as external-wait",
    "blockerOwner": "optional owner of the external wait",
    "resumeCondition": "optional exact condition that unblocks the successor",
    "nextCheckAt": "optional ISO timestamp for the next observation",
    "fallbackAt": "optional ISO timestamp for fallback if unchanged",
    "fallbackAction": "optional action to take if fallback is reached"
  }
}
\`\`\`

App: ${input.appDir}
Domain workspace: ${input.projectDir}

Task under review:
\`\`\`json
${JSON.stringify(input.task, null, 2)}
\`\`\`

Completion event fields:
\`\`\`json
${JSON.stringify(input.completion, null, 2)}
\`\`\`

${input.trigger}`.trim();
}

async function runReviewer(input: {
  ctx: WorkflowContext;
  agent: string;
  prompt: string;
  sessionId: string;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  const run = (sessionId: string) =>
    sessionCtx.runAgentSession
      ? sessionCtx.runAgentSession(input.agent, input.prompt, sessionId, {
          timeoutMs: 600_000,
        })
      : input.ctx.runAgent(input.agent, input.prompt);

  const first = await run(input.sessionId);
  if (!isTransientReviewerFailure(resultText(first))) return first;

  await new Promise((resolve) => setTimeout(resolve, 5_000));
  return run(`${input.sessionId}_retry_${Date.now()}`);
}

export function isTransientReviewerFailure(text: string): boolean {
  return (
    /(?:OpenAI API error|AuthenticationError).*(?:401|token expired)/is.test(
      text,
    ) ||
    /(?:OpenAI API error|No deployments available).*(?:429|cooldown|try again)/is.test(
      text,
    ) ||
    /OpenAI API error \(5\d\d\)/i.test(text)
  );
}

function appendReviewRun(appDir: string, entry: Record<string, unknown>): void {
  appendReviewerLedgerRowV2(appDir, "task-reviewer", entry);
}

function reviewDecisionId(input: {
  taskId: string;
  taskRevision: number;
  attemptId: string;
  review: StructuredReview;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        taskId: input.taskId,
        taskRevision: input.taskRevision,
        attemptId: input.attemptId,
        review: input.review,
      }),
    )
    .digest("hex")
    .slice(0, 24);
}

type PersistedReviewDecisionV2 = {
  reviewId: string;
  reviewedAt: string;
  review: StructuredReview;
};

function persistedReviewDecisionV2(
  rows: Array<Record<string, unknown>>,
  input: { taskId: string; taskRevision: number; attemptId: string },
): PersistedReviewDecisionV2 | null {
  for (const row of rows) {
    if (
      row.result !== "project.task.reviewed" ||
      row.task_id !== input.taskId ||
      row.task_revision !== input.taskRevision ||
      row.attempt_id !== input.attemptId ||
      typeof row.review_id !== "string" ||
      !row.review_id.trim() ||
      typeof row.ts !== "string" ||
      !row.review ||
      typeof row.review !== "object" ||
      Array.isArray(row.review)
    ) {
      continue;
    }
    return {
      reviewId: row.review_id,
      reviewedAt: row.ts,
      review: structuredReviewFromText(JSON.stringify(row.review)),
    };
  }
  return null;
}

function emitTaskReviewed(
  ctx: WorkflowContext,
  input: {
    task: TaskNode;
    taskRevision: number;
    attemptId: string;
    reviewId: string;
    reviewedAt: string;
    completion: Record<string, unknown>;
    review: StructuredReview;
  },
): void {
  ctx.dispatchEvent("project.task.reviewed", {
    target: { project: "aks-rp-e2e", taskId: input.task.id },
    project: "aks-rp-e2e",
    taskId: input.task.id,
    task_id: input.task.id,
    taskRevision: input.taskRevision,
    task_revision: input.taskRevision,
    attemptId: input.attemptId,
    attempt_id: input.attemptId,
    reviewId: input.reviewId,
    review_id: input.reviewId,
    reviewedAt: input.reviewedAt,
    reviewed_at: input.reviewedAt,
    decision: input.review.decision,
    confidence: input.review.confidence,
    summary: input.review.summary,
    findings: input.review.findings,
    feedback: input.review.feedback,
    suggestedFollowups: input.review.suggestedFollowups,
    suggested_followups: input.review.suggestedFollowups,
    artifacts: input.review.artifacts,
    verification: input.review.verification,
    events: input.review.events,
    ...(input.review.reviewAction
      ? {
          reviewAction: input.review.reviewAction,
          review_action: input.review.reviewAction,
        }
      : {}),
    completion: input.completion,
    review: input.review,
    reason: "task-review-completed",
    requested_by: "task-reviewer",
  });
}

function deliverReviewApplicationDecisionV2(input: {
  ctx: WorkflowContext;
  appDir: string;
  task: TaskNode;
  taskRevision: number;
  attemptId: string;
  completion: Record<string, unknown>;
  reviewId: string;
  reviewedAt: string;
  review: StructuredReview;
}): PendingActionDeliveryResultV2 | null {
  const action = reviewApplicationPendingActionV2(
    {
      taskId: input.task.id,
      taskRevision: input.taskRevision,
      attemptId: input.attemptId,
      completedAt:
        typeof taskTrace(input.task).last_worker_completed_at === "string"
          ? (taskTrace(input.task).last_worker_completed_at as string)
          : input.reviewedAt,
      latestDecision: input.review.decision,
      latestDecisionId: input.reviewId,
      latestDecisionAt: input.reviewedAt,
      deliveryState: "decision-pending-apply",
      actionDeliveryStatus: "pending",
      actionDeliveryAttempts: 0,
      actionAcceptedAt: null,
    },
    5 * 60_000,
  );
  if (!action) return null;
  const delivery = deliverPendingActionV2({
    action,
    now: new Date().toISOString(),
    priorReceipts: pendingActionDeliveryReceiptsV2(
      readReviewerLedgerRowsV2(input.appDir),
      action.key,
    ),
    dispatch: () =>
      emitTaskReviewed(input.ctx, {
        task: input.task,
        taskRevision: input.taskRevision,
        attemptId: input.attemptId,
        reviewId: input.reviewId,
        reviewedAt: input.reviewedAt,
        completion: input.completion,
        review: input.review,
      }),
  });
  if (delivery.receipt) {
    appendPendingActionDeliveryReceiptV2(
      input.appDir,
      "task-reviewer",
      delivery.receipt,
      {
        reviewId: input.reviewId,
        taskId: input.task.id,
        taskRevision: input.taskRevision,
        attemptId: input.attemptId,
      },
    );
  }
  return delivery;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const agent =
    field(ctx.task, "reviewer") ??
    field(ctx.task, "agent") ??
    ctx.agent ??
    "aks-reviewer";
  const pendingActionV2 = field(ctx.task, "pendingActionV2");

  if (trigger?.type !== "project.task.completed") {
    return ctx.done(
      `Task reviewer ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.completed.`,
    );
  }

  const taskId =
    triggerString(trigger, "taskId") || triggerString(trigger, "task_id");
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!taskId || !attemptId) {
    return ctx.done(
      "Task reviewer ignored completion event because taskId and attemptId are required.",
    );
  }
  const completedTaskRevision = completionTaskRevision(trigger);

  const config = taskTreeConfig({
    appDir,
    projectDir,
    worker: agent,
    maxConcurrent: 1,
  });
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId];
  const normalizationIsolatedWorktreeRequired =
    requiresNormalizationIsolatedWorktreeReview(tree, taskId);
  if (!task) {
    appendReviewRun(appDir, {
      result: "ignored",
      reason: "task-not-found",
      task_id: taskId,
      task_revision: completedTaskRevision,
      attempt_id: attemptId,
    });
    return ctx.done(
      `Task reviewer ignored stale completion for ${taskId}: task was not found.`,
    );
  }
  if (taskState(task) !== "review") {
    appendReviewRun(appDir, {
      result: "ignored",
      reason: "task-not-in-review",
      task_id: taskId,
      task_revision: completedTaskRevision,
      attempt_id: attemptId,
      state: taskState(task),
    });
    return ctx.done(
      `Task reviewer ignored stale completion for ${taskId}: task is ${taskState(task)}, not review.`,
    );
  }
  if (taskRevision(task) !== completedTaskRevision) {
    appendReviewRun(appDir, {
      result: "ignored",
      reason: "stale-revision",
      task_id: taskId,
      task_revision: completedTaskRevision,
      current_task_revision: taskRevision(task),
      attempt_id: attemptId,
    });
    return ctx.done(
      `Task reviewer ignored stale completion for ${taskId}: revision ${completedTaskRevision} is not current (${taskRevision(task)}).`,
    );
  }
  if (currentAttemptId(task) && currentAttemptId(task) !== attemptId) {
    appendReviewRun(appDir, {
      result: "ignored",
      reason: "stale-attempt",
      task_id: taskId,
      attempt_id: attemptId,
      current_attempt_id: currentAttemptId(task),
    });
    return ctx.done(
      `Task reviewer ignored stale completion for ${taskId}: attempt ${attemptId} is not current.`,
    );
  }

  const completionValue = triggerValue(trigger, "completion");
  const completion =
    completionValue &&
    typeof completionValue === "object" &&
    !Array.isArray(completionValue)
      ? (completionValue as Record<string, unknown>)
      : {
          taskId,
          task_id: taskId,
          taskRevision: completedTaskRevision,
          task_revision: completedTaskRevision,
          attemptId,
          attempt_id: attemptId,
          result: triggerValue(trigger, "result"),
          claim: triggerValue(trigger, "claim"),
          summary: triggerValue(trigger, "summary"),
          evidenceRefs: triggerValue(trigger, "evidenceRefs"),
          evidence_refs: triggerValue(trigger, "evidence_refs"),
        };

  const usePendingActionDelivery =
    pendingActionV2 === "review-application-revisioned" &&
    completedTaskRevision > 0 &&
    taskContext(task).controlPlaneVersion === 2;
  if (usePendingActionDelivery) {
    const persisted = persistedReviewDecisionV2(
      readReviewerLedgerRowsV2(appDir),
      {
        taskId,
        taskRevision: completedTaskRevision,
        attemptId,
      },
    );
    if (persisted) {
      const delivery = deliverReviewApplicationDecisionV2({
        ctx,
        appDir,
        task,
        taskRevision: completedTaskRevision,
        attemptId,
        completion,
        ...persisted,
      });
      if (!delivery) {
        return ctx.done(
          `Task reviewer could not reconstruct persisted pending review delivery for ${taskId}.`,
        );
      }
      if (!delivery.accepted) {
        return ctx.done(
          `Task reviewer persisted pending-action delivery for ${taskId} did not complete: ${delivery.reason}.`,
        );
      }
      return ctx.done(
        delivery.replayed
          ? `Task reviewer replay found accepted review delivery for ${taskId} attempt ${attemptId} from the persisted decision.`
          : `Task reviewer redelivered persisted review ${persisted.reviewId} for ${taskId} attempt ${attemptId} through PendingAction V2.`,
      );
    }
  }

  let validationNotes = validationNotesForCompletion(task, completion, {
    normalizationIsolatedWorktreeRequired,
  });
  validationNotes = mergeValidationNotes(
    validationNotes,
    featureScenarioCarrierValidationNotes({
      projectDir,
      task,
    }),
  );
  validationNotes = mergeValidationNotes(
    validationNotes,
    missingEvidenceValidationNotes({
      appDir,
      projectDir,
      completion,
    }),
  );
  let reviewerResult: unknown;
  try {
    reviewerResult = await runReviewer({
      ctx,
      agent,
      sessionId: reviewerSessionId(taskId, attemptId),
      prompt: buildReviewPrompt({
        appDir,
        projectDir,
        task,
        completion,
        validationNotes,
        trigger: triggerBlock(ctx.task),
        normalizationIsolatedWorktreeRequired,
      }),
    });
  } catch (error) {
    reviewerResult = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const reviewText = resultText(reviewerResult);
  const review = completeReviewCorrectionContract(
    task,
    enforceFeatureScenarioCarrierDecision(
      enforceNormalizationIsolationDecision(
        appendValidationNotesToReview(
          structuredReviewFromText(reviewText),
          validationNotes,
        ),
      ),
    ),
  );
  const reviewedAt = new Date().toISOString();
  const reviewId = reviewDecisionId({
    taskId,
    taskRevision: completedTaskRevision,
    attemptId,
    review,
  });
  appendReviewRun(appDir, {
    ts: reviewedAt,
    result: "project.task.reviewed",
    delivery_status: "pending",
    review_id: reviewId,
    task_id: taskId,
    task_revision: completedTaskRevision,
    attempt_id: attemptId,
    decision: review.decision,
    confidence: review.confidence,
    summary: review.summary,
    findings: review.findings,
    feedback: review.feedback,
    suggestedFollowups: review.suggestedFollowups,
    artifacts: review.artifacts,
    verification: review.verification,
    events: review.events,
    ...(review.reviewAction ? { reviewAction: review.reviewAction } : {}),
    review,
  });
  if (usePendingActionDelivery) {
    const delivery = deliverReviewApplicationDecisionV2({
      ctx,
      appDir,
      task,
      taskRevision: completedTaskRevision,
      attemptId,
      completion,
      reviewId,
      reviewedAt,
      review,
    });
    if (!delivery) {
      return ctx.done(
        `Task reviewer could not construct pending review delivery for ${taskId}.`,
      );
    }
    if (!delivery.accepted) {
      return ctx.done(
        `Task reviewer pending-action delivery for ${taskId} did not complete: ${delivery.reason}.`,
      );
    }
    return ctx.done(
      delivery.replayed
        ? `Task reviewer replay found accepted review delivery for ${taskId} attempt ${attemptId}.`
        : `Task reviewer delivered ${review.decision} review for ${taskId} attempt ${attemptId} through PendingAction V2.`,
    );
  }
  try {
    emitTaskReviewed(ctx, {
      task,
      taskRevision: completedTaskRevision,
      attemptId,
      reviewId,
      reviewedAt,
      completion,
      review,
    });
  } catch {
    appendReviewRun(appDir, {
      result: "project.task.reviewed.delivery-failed",
      review_id: reviewId,
      task_id: taskId,
      task_revision: completedTaskRevision,
      attempt_id: attemptId,
      delivery_status: "failed",
    });
    return ctx.done(
      `Task reviewer could not dispatch project.task.reviewed for ${taskId}.`,
    );
  }

  appendReviewRun(appDir, {
    result: "project.task.reviewed.delivery-accepted",
    review_id: reviewId,
    task_id: taskId,
    task_revision: completedTaskRevision,
    attempt_id: attemptId,
    delivery_status: "accepted",
  });
  return ctx.done(
    `Task reviewer emitted ${review.decision} review for ${taskId} attempt ${attemptId}.`,
  );
}

if (import.meta.main) {
  if (process.env.MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT !== "1") {
    console.error(
      "Direct workflow entrypoint is disabled by default. Set MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT=1 to run it.",
    );
    process.exit(0);
  }
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-reviewer",
    agent: "aks-reviewer",
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", message: "unavailable" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}
