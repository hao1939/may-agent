/**
 * task-reviewer — read-only first-pass review for completed task output.
 *
 * Handles project.task.completed by validating that the cited task is still in
 * live review state, asking an independent reviewer for a structured judgment,
 * and emitting project.task.reviewed for the planner to apply. This workflow
 * must not mutate tasks/tree.json.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { readTaskTree, type TaskNode } from "./lib/task-tree-store.ts";
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

type StructuredReview = {
  decision: ReviewDecision;
  confidence: ReviewConfidence;
  summary: string;
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

function currentAttemptId(task: TaskNode): string {
  const value = taskTrace(task).current_attempt_id;
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
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

function structuredReviewFromText(text: string): StructuredReview {
  const parsed = parseReviewJson(text);
  if (!parsed) {
    return {
      decision: "escalate",
      confidence: "low",
      summary:
        "Task reviewer did not emit valid TASK_REVIEW_JSON; planner must inspect completion manually.",
      findings: ["reviewer-output-not-structured"],
      feedback: [text.slice(0, 1800)],
      suggestedFollowups: [],
    };
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
  };
}

function completionSummary(completion: Record<string, unknown>): string {
  for (const key of ["summary", "message", "result"]) {
    const value = completion[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function evidenceRefs(completion: Record<string, unknown>): string[] {
  return stringList(completion.evidenceRefs).concat(
    stringList(completion.evidence_refs),
  );
}

function deterministicReviewForCompletion(
  completion: Record<string, unknown>,
): StructuredReview | null {
  if (
    completionSummary(completion) === EMPTY_ASSISTANT_TURN &&
    evidenceRefs(completion).length === 0
  ) {
    return {
      decision: "redo",
      confidence: "high",
      summary:
        "Worker attempt produced an empty assistant turn and no evidence, so the task must be retried instead of accepted or treated as a real blocked wait.",
      findings: ["worker-empty-assistant-turn", "worker-no-evidence"],
      feedback: [
        "Retry the same task with a fresh session and require a concrete result: evidence, a repo-local change, or an exact external wait with owner and resume condition.",
      ],
      suggestedFollowups: [],
    };
  }
  return null;
}

function reviewerSessionId(taskId: string, attemptId: string): string {
  const safeTask = taskId.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
  const safeAttempt = attemptId.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
  return `s_task_review_${safeTask}_${safeAttempt}`;
}

function buildReviewPrompt(input: {
  appDir: string;
  projectDir: string;
  task: TaskNode;
  completion: Record<string, unknown>;
  trigger: string;
}): string {
  return `Task Review Mode

You are the read-only independent reviewer for one completed aks-rp-e2e task.
Judge whether the worker completion satisfies the task acceptance criteria.

Boundaries:
- Do not mutate tasks/tree.json, loop state, project files, or domain files.
- Do not assign tasks, create follow-up tasks, mark tasks done, or run live AKS
  tests.
- Review only this completed task, its acceptance criteria, worker result,
  evidence refs, and immediately relevant artifacts/files.
- The planner is the only workflow that applies your judgment to the task tree.

Decision meanings:
- accept: evidence satisfies the task acceptance criteria.
- redo: same task should be rejected/retried with feedback.
- followup: current work is useful but needs a concrete successor.
- blocked: a real external/environment/product wait remains.
- escalate: owner/human judgment is required before deciding.

Finish with exactly one structured block:

TASK_REVIEW_JSON:
\`\`\`json
{
  "decision": "accept | redo | followup | blocked | escalate",
  "confidence": "high | medium | low",
  "summary": "one concise review summary",
  "findings": ["specific evidence-backed findings"],
  "feedback": ["actionable retry/rework feedback when not accepting"],
  "suggestedFollowups": ["optional concrete follow-up task ideas"]
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
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.agent, input.prompt, input.sessionId, {
        timeoutMs: 600_000,
      })
    : input.ctx.runAgent(input.agent, input.prompt);
}

function appendReviewRun(appDir: string, entry: Record<string, unknown>): void {
  const path = join(appDir, ".state", "task-reviewer-runs.jsonl");
  mkdirSync(join(appDir, ".state"), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      workflow: "task-reviewer",
      ...entry,
    })}\n`,
  );
}

function emitTaskReviewed(
  ctx: WorkflowContext,
  input: {
    task: TaskNode;
    attemptId: string;
    completion: Record<string, unknown>;
    review: StructuredReview;
  },
): void {
  ctx.dispatchEvent("project.task.reviewed", {
    target: { project: "aks-rp-e2e", taskId: input.task.id },
    project: "aks-rp-e2e",
    taskId: input.task.id,
    task_id: input.task.id,
    attemptId: input.attemptId,
    attempt_id: input.attemptId,
    decision: input.review.decision,
    confidence: input.review.confidence,
    summary: input.review.summary,
    findings: input.review.findings,
    feedback: input.review.feedback,
    suggestedFollowups: input.review.suggestedFollowups,
    suggested_followups: input.review.suggestedFollowups,
    completion: input.completion,
    review: input.review,
    reason: "task-review-completed",
    requested_by: "task-reviewer",
  });
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

  const config = taskTreeConfig({
    appDir,
    projectDir,
    worker: agent,
    maxConcurrent: 1,
  });
  const task = readTaskTree(config).tasks[taskId];
  if (!task) {
    appendReviewRun(appDir, {
      result: "ignored",
      reason: "task-not-found",
      task_id: taskId,
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
      attempt_id: attemptId,
      state: taskState(task),
    });
    return ctx.done(
      `Task reviewer ignored stale completion for ${taskId}: task is ${taskState(task)}, not review.`,
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
          attemptId,
          attempt_id: attemptId,
          result: triggerValue(trigger, "result"),
          claim: triggerValue(trigger, "claim"),
          summary: triggerValue(trigger, "summary"),
          evidenceRefs: triggerValue(trigger, "evidenceRefs"),
          evidence_refs: triggerValue(trigger, "evidence_refs"),
        };

  let review = deterministicReviewForCompletion(completion);
  if (!review) {
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
          trigger: triggerBlock(ctx.task),
        }),
      });
    } catch (error) {
      reviewerResult = {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const reviewText = resultText(reviewerResult);
    review = structuredReviewFromText(reviewText);
  }
  try {
    emitTaskReviewed(ctx, { task, attemptId, completion, review });
  } catch {
    appendReviewRun(appDir, {
      result: "dispatch-failed",
      task_id: taskId,
      attempt_id: attemptId,
      review,
    });
    return ctx.done(
      `Task reviewer could not dispatch project.task.reviewed for ${taskId}.`,
    );
  }

  appendReviewRun(appDir, {
    result: "project.task.reviewed",
    task_id: taskId,
    attempt_id: attemptId,
    decision: review.decision,
    confidence: review.confidence,
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
