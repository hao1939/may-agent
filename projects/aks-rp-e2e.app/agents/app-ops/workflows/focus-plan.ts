/**
 * focus-plan — slower strategy cadence for aks-rp-e2e.
 *
 * The normal app-ops/worker loop keeps tasks moving. This workflow periodically
 * asks app-ops to review the bigger picture and request human approval when
 * the focus materially changes or drifts off track. It is observation-only;
 * the app controller applies any accepted task changes.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  resolveTaskTreePath,
  workflowResultVersion,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  planningObservation,
  readTaskObservation,
  type ObservedTask,
  type ObservedTaskTree,
  type TaskPlanningObservation,
} from "./lib/task-observation.ts";
import {
  field,
  parseTriggerEvent,
  resolveAppDir,
  resultText,
  triggerBlock,
  triggerString,
} from "./lib/workflow-input.ts";

export const name = "focus-plan";
export const description =
  "Review aks-rp-e2e mid-term focus and return an evidence-backed proposal without mutating the task graph.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "focus-plan-v1",
  input: {
    required: ["project.focus.review.requested"],
    optional: ["mode", "reason"],
    description:
      "Ask the owner agent to review the current project focus and record the evidence-backed result.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence"],
    description:
      "Records one focus-plan run and emits owner/approval events when the reviewed focus requires follow-up.",
  },
};

type SessionWorkflowContext = WorkflowContext & {
  runAgentSession?: (
    agent: string,
    prompt: string,
    sessionId: string,
    opts?: { timeoutMs?: number },
  ) => Promise<unknown>;
};

type FocusResult =
  | "on_track"
  | "updated"
  | "needs_approval"
  | "off_track"
  | "completed"
  | "blocked"
  | "failed_known_issues";

const focusResultValues = new Set<FocusResult>([
  "on_track",
  "updated",
  "needs_approval",
  "off_track",
  "completed",
  "blocked",
  "failed_known_issues",
]);

function focusRunKind(
  trigger: ReturnType<typeof parseTriggerEvent>,
): "proposal" | "review" {
  const mode = triggerString(trigger, "mode").toLowerCase();
  return mode === "plan" || mode === "proposal" ? "proposal" : "review";
}

function focusSessionId(kind: "proposal" | "review"): string {
  const stem =
    kind === "proposal" ? "s_focus_plan_strategy" : "s_focus_plan_review";
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stem}_${stamp}_${suffix}`;
}

function extractMarker(text: string, name: string): string {
  const match = text.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function focusResultFromMarker(text: string): FocusResult | null {
  const raw = extractMarker(text, "FOCUS_PLAN_RESULT").toLowerCase();
  return focusResultValues.has(raw as FocusResult)
    ? (raw as FocusResult)
    : null;
}

function focusResultText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return resultText(result);
  const typed = result as {
    message?: unknown;
    summary?: unknown;
    lastAssistantText?: unknown;
    finishResult?: { summary?: unknown };
  };
  const texts = [
    typed.message,
    typed.summary,
    typed.lastAssistantText,
    typed.finishResult?.summary,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    texts.find((value) => focusResultFromMarker(value)) ?? resultText(result)
  );
}

function inferFocusResult(input: {
  text: string;
  result: unknown;
}): FocusResult {
  const marker = focusResultFromMarker(input.text);
  if (marker) return marker;

  const typed =
    input.result && typeof input.result === "object"
      ? (input.result as {
          status?: unknown;
          finishResult?: { status?: unknown };
        })
      : null;
  const finishStatus =
    typeof typed?.finishResult?.status === "string"
      ? typed.finishResult.status.toLowerCase()
      : "";
  if (finishStatus === "blocked") return "blocked";

  const raw = input.text.trim();
  const lower = raw.toLowerCase();
  const blockedLanguage =
    /\b(blocked|pending approval|awaiting approval|awaiting human approval|approval still pending|owner-return|approval wait|governing wait|waiting on)\b/.test(
      lower,
    );
  const onTrackLanguage =
    /\b(on track|still on track|remains on track|right branch|remains the right|correct 12-24h mission|truthful 12-24h mission|remains correct)\b/.test(
      lower,
    );

  if (blockedLanguage && onTrackLanguage) return "blocked";
  if (
    /\b(needs approval|approval requested|material change|proposed 12-24h focus shift|new direction|refresh the visible focus branch)\b/.test(
      lower,
    )
  ) {
    return "needs_approval";
  }
  if (
    /\b(off track|needs human attention|significant pivot|adjust direction|hold for now)\b/.test(
      lower,
    )
  ) {
    return "off_track";
  }
  if (
    /\b(failed known issues|known issues were exhausted|local repair paths were exhausted)\b/.test(
      lower,
    )
  ) {
    return "failed_known_issues";
  }
  if (
    /\b(focus done|goal achieved|project at true terminal completion|project fully closed|focus plan accepted and completed)\b/.test(
      lower,
    )
  ) {
    return "completed";
  }
  if (onTrackLanguage) return "on_track";
  if (
    typeof typed?.status === "string" &&
    typed.status.toLowerCase() === "error"
  ) {
    return "blocked";
  }
  return "updated";
}

function truncate(text: string, max = 1800): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function focusPlanId(kind: "proposal" | "review", result: FocusResult): string {
  return `focus-${kind}-${result}`;
}

function packetCount(packet: TaskPlanningObservation, status: string): number {
  const counts =
    packet && typeof packet === "object" && packet.counts
      ? (packet.counts as Record<string, unknown>)
      : null;
  const raw = counts?.[status];
  return typeof raw === "number" && Number.isFinite(raw)
    ? raw
    : Number(raw ?? 0) || 0;
}

function liveFrontierEvidence(packet: TaskPlanningObservation): {
  activeTaskIds: string[];
  reviewTaskIds: string[];
  runnableTaskIds: string[];
  waitingTaskIds: string[];
  activeCount: number;
  blockedCount: number;
  backlogCount: number;
} {
  return {
    activeTaskIds: [...(packet.active_task_ids ?? [])],
    reviewTaskIds: [...(packet.frontier.review ?? [])],
    runnableTaskIds: [...(packet.frontier.runnable ?? [])],
    waitingTaskIds: [...(packet.frontier.waiting ?? [])],
    activeCount: packetCount(packet, "active"),
    blockedCount: packetCount(packet, "blocked"),
    backlogCount: packetCount(packet, "backlog"),
  };
}

function liveFrontierEvidenceText(packet: TaskPlanningObservation): string {
  const evidence = liveFrontierEvidence(packet);
  return [
    `counts.active=${evidence.activeCount}`,
    `active_task_ids=${JSON.stringify(evidence.activeTaskIds)}`,
    `frontier.review=${JSON.stringify(evidence.reviewTaskIds)}`,
    `frontier.runnable=${JSON.stringify(evidence.runnableTaskIds)}`,
    `frontier.waiting=${JSON.stringify(evidence.waitingTaskIds)}`,
    `counts.blocked=${evidence.blockedCount}`,
    `counts.backlog=${evidence.backlogCount}`,
  ].join(", ");
}

function hasNonterminalLiveFrontier(packet: TaskPlanningObservation): boolean {
  const evidence = liveFrontierEvidence(packet);
  return (
    evidence.activeTaskIds.length > 0 ||
    evidence.reviewTaskIds.length > 0 ||
    evidence.runnableTaskIds.length > 0 ||
    evidence.waitingTaskIds.length > 0 ||
    evidence.activeCount > 0 ||
    evidence.blockedCount > 0 ||
    evidence.backlogCount > 0
  );
}

function terminalLanguagePresent(text: string): boolean {
  return /at ceiling|disable review schedule|no actionable work remains|no further autonomous work/i.test(
    text,
  );
}

function guardFocusSummary(input: {
  packet: TaskPlanningObservation;
  result: FocusResult;
  summary: string;
}): { result: FocusResult; summary: string } {
  const title =
    extractMarker(input.summary, "FOCUS_PLAN_TITLE") || "Focus review";
  const ownerNext =
    extractMarker(input.summary, "OWNER_NEXT") ||
    "Keep the app-ops review loop active and reconcile the live task-tree frontier before any closure decision.";
  const evidenceText = liveFrontierEvidenceText(input.packet);
  const terminalClaim =
    input.result === "completed" ||
    input.result === "failed_known_issues" ||
    terminalLanguagePresent(input.summary);

  if (terminalClaim && hasNonterminalLiveFrontier(input.packet)) {
    return {
      result: "updated",
      summary: [
        "FOCUS_PLAN_RESULT: updated",
        `FOCUS_PLAN_TITLE: ${title}`,
        `FOCUS_PLAN_SUMMARY: Terminal/completed or disable-review guidance was suppressed because the current live task-tree frontier is still nonterminal. Evidence: ${evidenceText}. Keep review scheduling enabled until the live frontier is actually terminal.`,
        `OWNER_NEXT: ${ownerNext}`,
      ].join("\n"),
    };
  }

  if (input.result === "completed" || input.result === "failed_known_issues") {
    if (/LIVE_FRONTIER_EVIDENCE:/i.test(input.summary)) {
      return input;
    }
    return {
      result: input.result,
      summary: `${input.summary.trim()}\nLIVE_FRONTIER_EVIDENCE: Terminal claim verified against the current live task-tree frontier. ${evidenceText}.`,
    };
  }

  return input;
}

function approvalQuestion(input: {
  result: FocusResult;
  kind: "proposal" | "review";
  title: string;
}): string {
  if (input.result === "off_track") {
    return "The current focus is off track. Should the project continue, adjust direction, or hold for now?";
  }
  const title = input.title || "proposed focus plan";
  return `Approve the ${input.kind} focus direction "${title}"?`;
}

function approvalText(input: {
  result: FocusResult;
  kind: "proposal" | "review";
  title: string;
  summary: string;
  plannerNext: string;
}): string {
  const question = approvalQuestion(input);
  const summary = truncate(input.summary, 1700);
  const plannerNext = input.plannerNext
    ? `\n\nOwner next:\n${truncate(input.plannerNext, 500)}`
    : "";
  return [
    input.result === "off_track"
      ? "AKS RP E2E focus needs attention"
      : "AKS RP E2E focus plan needs approval",
    "",
    `Decision: ${question}`,
    "",
    "Options:",
    "- approve: accept the proposed direction/risk envelope and let the owner continue.",
    "- adjust <your changes>: accept the idea with changes; owner must update the focus branch first.",
    "- hold: do not start the proposed direction; owner should keep only safe bookkeeping work.",
    "",
    "Context:",
    summary,
    plannerNext,
    "",
    "Reply to this Telegram message with approve, adjust ..., or hold. The reply is routed back to aks-rp-e2e app-ops.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(input: {
  appDir: string;
  projectDir: string;
  agent: string;
  kind: "proposal" | "review";
  packet: TaskPlanningObservation;
  trigger: string;
}): string {
  const cadence =
    input.kind === "proposal"
      ? "This is the regular mid-term focus planning pass."
      : "This is the regular focus progress review pass.";

  return `AKS RP E2E Focus Plan Mode

${cadence}

Purpose:
- Reduce the need for the human owner to repeatedly inspect status and steer.
- Keep one clear mid-term focus mission visible to the accountable owner.
- Keep normal owner/worker execution inside the approved focus when useful.
- Review progress regularly so we know whether the project is on track.

Boundaries:
- This workflow is observation-only. Do not edit task-tree or project-state files.
- Return proposed changes through the result and semantic events; the app
  controller is the only task-graph mutation authority.
- Do not execute worker tasks or live tests from this session.
- Do not replace the durable project lanes. The focus branch should connect to
  the existing lanes: source discovery, feature extraction, spec generation,
  replay implementation, execution/verification, and model feedback.
- Do not create ceremonial control tasks. A focus branch is useful only when it
  clarifies concrete project work, success criteria, and allowed execution risk.
- If the current focus is still good, update progress/context and keep it
  moving. If it is stale, completed, off track, or materially changing, make
  that obvious in the result and request approval.
- Approval is for direction/risk, not for every leaf task. Once approved, the
  app controller should keep reconciling concrete work until done or waiting.

Expected durable shape:
- Propose the active focus as a readable mission,
  for example kind "focus_plan" with context.horizon, context.success_criteria,
  context.progress_review, and child tasks under existing domain lanes when
  possible.
- Include the exact actions the owner should ask the controller to apply.
- Do not write the proposal directly; the owner/controller persists accepted
  focus state after this workflow returns.

Focus review questions:
1. What did the project learn or verify since the last focus review?
2. Are live executions producing useful evidence, or should we shift to
   spec/replay/source discovery for a while?
3. Are blockers local runner/spec issues, external product/environment issues,
   or bad task decomposition?
4. Is parallel work filled with concrete executable leaves?
5. Does the next 12-24h focus still match the project goal: learn AKS RP input
   and expectation space, generate runnable specs/replays, execute them, and
   feed evidence back into the model?

Commands you may use:
- cd ${input.appDir} && bun run task-tree summary
- cd ${input.appDir} && bun run task-tree packet
- cd ${input.appDir} && bun run task-tree frontier
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.task.completed-24h
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.run.live-started-24h
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.run.live-succeeded-24h
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.spec.unverified-count
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.spec.failed-count
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.model.unknown-path-count
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && bun run status -- --json
- cd ${input.projectDir} && git status --short

Focus mission lifecycle:
- A focus plan is a bounded mission, not a normal status note.
- While the focus is running, every failure must become one of: diagnosis,
  repair, smallest truthful rerun, exact blocked wait, escalation, or terminal
  known issue.
- Use FOCUS_PLAN_RESULT: completed only when the goal is met with linked
  evidence.
- Use FOCUS_PLAN_RESULT: failed_known_issues only when the goal did not pass,
  every reasonable local repair/rerun path has been exhausted or bounded, and
  the remaining issues are listed with evidence and next resume/escalation
  conditions.
- Use FOCUS_PLAN_RESULT: blocked when the focus is paused on a real external
  wait that still has a watcher and fallback.

Finish with these exact markers:

FOCUS_PLAN_RESULT: on_track | updated | needs_approval | off_track | completed | blocked | failed_known_issues
FOCUS_PLAN_TITLE: <short title>
FOCUS_PLAN_SUMMARY: <human-readable summary suitable for Telegram>
OWNER_NEXT: <what the normal owner loop should do next>

Use FOCUS_PLAN_RESULT: needs_approval when you propose a new or materially
changed 12-24h direction/risk envelope. Use off_track when the approved focus is
not progressing and needs human attention or a significant pivot.

App: ${input.appDir}
Domain workspace: ${input.projectDir}
Agent: ${input.agent}

Current compact task-tree packet:
\`\`\`json
${JSON.stringify(input.packet, null, 2)}
\`\`\`

${input.trigger}`.trim();
}

async function runFocusAgent(input: {
  ctx: WorkflowContext;
  agent: string;
  prompt: string;
  sessionId: string;
}): Promise<unknown> {
  const sessionCtx = input.ctx as SessionWorkflowContext;
  return sessionCtx.runAgentSession
    ? sessionCtx.runAgentSession(input.agent, input.prompt, input.sessionId, {
        timeoutMs: 1_200_000,
      })
    : input.ctx.runAgent(input.agent, input.prompt);
}

function dispatchOwnerRequested(
  ctx: WorkflowContext,
  input: {
    result: FocusResult;
    kind: "proposal" | "review";
    summary: string;
  },
): boolean {
  try {
    ctx.dispatchEvent("project.owner.requested", {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      reason: `focus-plan-${input.kind}`,
      focusResult: input.result,
      focus_result: input.result,
      requested_by: "focus-plan",
      params: {
        summary: truncate(input.summary, 2400),
        instruction:
          "Review the focus result and return structured controller actions for work inside the approved focus when useful.",
      },
    });
    return true;
  } catch {
    return false;
  }
}

type FocusApprovalLineage = {
  governingTaskId?: string;
  taskId?: string;
  planId?: string;
  pathId?: string;
  approvalId?: string;
  waitId?: string;
  packetPath?: string;
  requestEventId?: number;
  messageId?: number;
  acceptedDecisions?: string[];
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function taskState(task: ObservedTask | undefined): string {
  return stringValue(task?.status ?? task?.state ?? "backlog") || "backlog";
}

function liveFocusPlanTask(tree: ObservedTaskTree): ObservedTask | null {
  const live = Object.values(tree.tasks ?? {})
    .filter((task) => task.kind === "focus_plan" && taskState(task) !== "done")
    .sort((a, b) => a.id.localeCompare(b.id));
  return live[0] ?? null;
}

function lineageFromApprovalRecord(input: {
  approval: Record<string, unknown> | null;
  focusTaskId: string;
  governingTaskId?: string;
}): FocusApprovalLineage | null {
  const approval = input.approval;
  if (!approval) return null;
  const eventType = stringValue(approval.type ?? approval.eventType);
  if (eventType && eventType !== "project.approval.submitted") return null;

  const directTaskId = stringValue(approval.taskId);
  if (!directTaskId || directTaskId === input.focusTaskId) {
    const pathId = stringValue(approval.pathId);
    const approvalId = stringValue(approval.approvalId);
    const waitId = stringValue(approval.waitId);
    const packetPath = stringValue(approval.packetPath);
    const planId = stringValue(approval.planId);
    if (pathId || approvalId || waitId || planId) {
      return {
        governingTaskId: input.governingTaskId,
        taskId: directTaskId || input.focusTaskId,
        planId,
        pathId,
        approvalId,
        waitId,
        packetPath,
        requestEventId: numberValue(approval.requestEventId),
        messageId: numberValue(approval.messageId),
        acceptedDecisions: stringList(approval.acceptedDecisions),
      };
    }
  }

  for (const entry of Array.isArray(approval.lineages)
    ? approval.lineages
    : []) {
    const lineage = recordValue(entry);
    if (!lineage || stringValue(lineage.taskId) !== input.focusTaskId) continue;
    const pathId = stringValue(lineage.pathId);
    const approvalId = stringValue(lineage.approvalId);
    const waitId = stringValue(lineage.waitId);
    const packetPath = stringValue(lineage.packetPath);
    const planId = stringValue(lineage.planId);
    if (!pathId && !approvalId && !waitId && !planId) continue;
    return {
      governingTaskId: input.governingTaskId,
      taskId: input.focusTaskId,
      planId,
      pathId,
      approvalId,
      waitId,
      packetPath,
      requestEventId: numberValue(lineage.requestEventId),
      messageId: numberValue(lineage.messageId),
      acceptedDecisions: stringList(approval.acceptedDecisions),
    };
  }

  return null;
}

function resolveFocusApprovalLineage(
  appDir: string,
): FocusApprovalLineage | null {
  const tree = readTaskObservation(appDir);
  const focusTask = liveFocusPlanTask(tree);
  if (!focusTask) return null;

  for (const [taskId, resource] of Object.entries(tree.resources ?? {})) {
    if (resource.status?.phase !== "waiting") continue;
    const hasApprovalCondition = (resource.status.conditionIds ?? []).some(
      (conditionId) =>
        tree.conditions?.[conditionId]?.spec?.type ===
        "project.approval.submitted",
    );
    if (!hasApprovalCondition) continue;

    const resourceInput = recordValue(resource.spec?.input);
    const approvalInput =
      recordValue(resourceInput?.approval) ??
      recordValue(resourceInput?.approvalLineage) ??
      resourceInput;
    const trigger = recordValue(tree.taskTriggers?.[taskId]?.event);
    for (const approval of [trigger, approvalInput]) {
      const resolved = lineageFromApprovalRecord({
        approval,
        focusTaskId: focusTask.id,
        governingTaskId: taskId,
      });
      if (resolved) return resolved;
    }
  }

  return null;
}

function dispatchHumanApproval(
  ctx: WorkflowContext,
  input: {
    appDir: string;
    projectDir: string;
    result: FocusResult;
    kind: "proposal" | "review";
    title: string;
    summary: string;
  },
): boolean {
  if (input.result !== "needs_approval" && input.result !== "off_track") {
    return true;
  }

  const plannerNext =
    extractMarker(input.summary, "OWNER_NEXT") ||
    extractMarker(input.summary, "PLANNER_NEXT");
  const title =
    input.title ||
    (input.result === "off_track"
      ? "AKS RP E2E focus is off track"
      : "AKS RP E2E focus plan needs approval");
  const preservedLineage = resolveFocusApprovalLineage(input.appDir);
  const planId =
    preservedLineage?.planId || focusPlanId(input.kind, input.result);
  const question = approvalQuestion({ ...input, title });
  const text = approvalText({ ...input, title, plannerNext });
  const directEvent = {
    type: "project.approval.submitted",
    project: "aks-rp-e2e",
    projectPath: "projects/aks-rp-e2e.app",
    approvalKind: "focus-plan",
    planId,
    ...(preservedLineage?.pathId ? { pathId: preservedLineage.pathId } : {}),
    ...(preservedLineage?.approvalId
      ? { approvalId: preservedLineage.approvalId }
      : {}),
    ...(preservedLineage?.waitId ? { waitId: preservedLineage.waitId } : {}),
    ...(preservedLineage?.packetPath
      ? { packetPath: preservedLineage.packetPath }
      : {}),
  };
  const approval = {
    kind: "focus-plan",
    planId,
    focusResult: input.result,
    focusKind: input.kind,
    ...(preservedLineage?.pathId ? { pathId: preservedLineage.pathId } : {}),
    ...(preservedLineage?.approvalId
      ? { approvalId: preservedLineage.approvalId }
      : {}),
    ...(preservedLineage?.waitId ? { waitId: preservedLineage.waitId } : {}),
    ...(preservedLineage?.packetPath
      ? { packetPath: preservedLineage.packetPath }
      : {}),
    question,
    options: [
      {
        id: "approve",
        label: "Approve",
        effect:
          "Owner accepts the focus direction and returns bounded controller actions inside it.",
      },
      {
        id: "adjust",
        label: "Adjust",
        effect:
          "Owner updates desired focus state according to the reply through controller actions.",
      },
      {
        id: "hold",
        label: "Hold",
        effect:
          "Owner does not start the proposed direction and only keeps safe bookkeeping work.",
      },
    ],
    directEvent,
  };
  const requestedAction =
    preservedLineage?.approvalId || preservedLineage?.waitId
      ? "Reply to this notification with approve, adjust <changes>, or hold. The reply is emitted to projects/aks-rp-e2e.app as project.approval.submitted carrying the preserved approvalId/waitId lineage."
      : "Reply to this notification with approve, adjust <changes>, or hold. The reply is emitted to projects/aks-rp-e2e.app as project.approval.submitted.";
  const resumeCondition =
    preservedLineage?.approvalId || preservedLineage?.waitId
      ? "Resume the governing focus approval wait when project.approval.submitted carries the preserved approvalId or waitId with a bounded decision."
      : undefined;
  const dedupKey =
    preservedLineage?.approvalId || `aks-rp-e2e:focus-plan:${input.result}`;

  try {
    ctx.dispatchEvent("message.created", {
      target: { project: "aks-rp-e2e", human: true },
      from: "aks-explorer",
      to: "human",
      content: text,
      priority: input.result === "off_track" ? "P1" : "P2",
      intent: "focus-plan-approval",
      project: "aks-rp-e2e",
      projectId: "projects/aks-rp-e2e.app",
      domainProjectId: "aks-rp-e2e",
      projectPath: "projects/aks-rp-e2e.app",
      reason: title,
      requestedAction,
      approval,
      ...(preservedLineage?.pathId ? { pathId: preservedLineage.pathId } : {}),
      ...(preservedLineage?.approvalId
        ? { approvalId: preservedLineage.approvalId }
        : {}),
      ...(preservedLineage?.waitId ? { waitId: preservedLineage.waitId } : {}),
      ...(preservedLineage?.packetPath
        ? { packetPath: preservedLineage.packetPath }
        : {}),
      ...(resumeCondition ? { resumeCondition } : {}),
      focusResult: input.result,
      focusKind: input.kind,
      summary: truncate(input.summary, 3000),
      ownerNext: truncate(plannerNext, 1000),
      plannerNext: truncate(plannerNext, 1000),
      evidence: {
        focusPlanId: planId,
        ...(preservedLineage?.governingTaskId
          ? {
              governingFocusApprovalWaitTaskId:
                preservedLineage.governingTaskId,
            }
          : {}),
        ...(preservedLineage?.pathId
          ? { preservedFocusApprovalPathId: preservedLineage.pathId }
          : {}),
        ...(preservedLineage?.approvalId
          ? { preservedFocusApprovalId: preservedLineage.approvalId }
          : {}),
        ...(preservedLineage?.waitId
          ? { preservedFocusWaitId: preservedLineage.waitId }
          : {}),
        appTaskTree: resolveTaskTreePath(input.appDir),
        projectState: join(input.appDir, ".state", "project-state.json"),
        domainStatusCommand: `cd ${input.projectDir} && bun run status -- --gaps`,
        kanban: "/projects/aks-rp-e2e.app/ui/kanban/",
      },
      dedupKey,
    });
    return true;
  } catch {
    return false;
  }
}

function finishFocusReview(
  ctx: WorkflowContext,
  input: {
    state: "converged" | "needs-owner";
    summary: string;
    evidence: string[];
  },
): WorkflowResult {
  return ctx.done(input.summary, {
    state: input.state,
    summary: input.summary,
    evidence: input.evidence,
    actions: [],
  });
}

function appendFocusRun(appDir: string, entry: Record<string, unknown>): void {
  const path = join(appDir, ".state", "focus-plan-runs.jsonl");
  mkdirSync(join(appDir, ".state"), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      workflow: "focus-plan",
      ...entry,
    })}\n`,
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const triggerType = trigger?.type;
  const kind = focusRunKind(trigger);
  const agent =
    field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent;
  const packet = planningObservation(
    appDir,
    Number(field(ctx.task, "maxConcurrent") ?? 50),
  );

  const focusAgentResult = await runFocusAgent({
    ctx,
    agent,
    sessionId: focusSessionId(kind),
    prompt: buildPrompt({
      appDir,
      projectDir,
      agent,
      kind,
      packet,
      trigger: triggerBlock(ctx.task),
    }),
  });

  const rawSummary = focusResultText(focusAgentResult);
  const guarded = guardFocusSummary({
    packet,
    result: inferFocusResult({ text: rawSummary, result: focusAgentResult }),
    summary: rawSummary,
  });
  const summary = guarded.summary;
  const result = guarded.result;
  const title = extractMarker(summary, "FOCUS_PLAN_TITLE");
  const approvalDelivered = dispatchHumanApproval(ctx, {
    appDir,
    projectDir,
    result,
    kind,
    title,
    summary,
  });
  const ownerDelivered = dispatchOwnerRequested(ctx, {
    result,
    kind,
    summary,
  });
  appendFocusRun(appDir, {
    kind,
    trigger_type: triggerType ?? "manual",
    result,
    title,
    summary: truncate(summary, 4000),
  });

  const resultSummary = `Focus-plan ${kind} completed with result ${result}. Summary: ${summary}`;
  return finishFocusReview(ctx, {
    state: approvalDelivered && ownerDelivered ? "converged" : "needs-owner",
    summary: resultSummary,
    evidence: [`focus-plan:${kind}:${result}`, ".state/focus-plan-runs.jsonl"],
  });
}
