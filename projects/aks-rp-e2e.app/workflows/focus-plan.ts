/**
 * focus-plan — slower strategy cadence for aks-rp-e2e.
 *
 * The normal app-ops/worker loop keeps tasks moving. This workflow periodically
 * asks app-ops to review the bigger picture, maintain one current
 * focus branch in the task tree, and request human approval when the focus
 * materially changes or drifts off track.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  resolveTaskTreePath,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  planningPacket,
  taskTreeConfig,
  type TaskPlanningPacket,
} from "./lib/task-tree-tools.ts";
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
  "Regularly review aks-rp-e2e mid-term focus, update the task-tree focus branch, and request human approval when needed.";

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

function focusResult(text: string): FocusResult {
  const raw = extractMarker(text, "FOCUS_PLAN_RESULT").toLowerCase();
  if (
    raw === "on_track" ||
    raw === "updated" ||
    raw === "needs_approval" ||
    raw === "off_track" ||
    raw === "completed" ||
    raw === "blocked" ||
    raw === "failed_known_issues"
  ) {
    return raw;
  }
  if (/needs approval|approve this plan|approval request/i.test(text))
    return "needs_approval";
  if (/off track|not on track|stale focus/i.test(text)) return "off_track";
  if (/failed[-_ ]known[-_ ]issues|known issues|terminal failed/i.test(text))
    return "failed_known_issues";
  if (/completed|focus done/i.test(text)) return "completed";
  return "updated";
}

function truncate(text: string, max = 1800): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function focusPlanId(kind: "proposal" | "review", result: FocusResult): string {
  return `focus-${kind}-${result}`;
}

function packetCount(packet: TaskPlanningPacket, status: string): number {
  const counts =
    packet && typeof packet === "object" && packet.counts
      ? (packet.counts as Record<string, unknown>)
      : null;
  const raw = counts?.[status];
  return typeof raw === "number" && Number.isFinite(raw)
    ? raw
    : Number(raw ?? 0) || 0;
}

function liveFrontierEvidence(packet: TaskPlanningPacket): {
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

function liveFrontierEvidenceText(packet: TaskPlanningPacket): string {
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

function hasNonterminalLiveFrontier(packet: TaskPlanningPacket): boolean {
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
  packet: TaskPlanningPacket;
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
  packet: TaskPlanningPacket;
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
- Maintain one visible mid-term focus branch in the task tree.
- Keep normal owner/worker execution inside the approved focus when useful.
- Review progress regularly so we know whether the project is on track.

Boundaries:
- Do not execute worker tasks or live tests from this session.
- Do not replace the durable project lanes. The focus branch should connect to
  the existing lanes: source discovery, feature extraction, spec generation,
  replay implementation, execution/verification, and model feedback.
- Do not create ceremonial control tasks. A focus branch is useful only when it
  clarifies concrete project work, success criteria, and allowed execution risk.
- If the current focus is still good, update progress/context and keep it
  moving. If it is stale, completed, off track, or materially changing, make
  that obvious in the task tree and request approval.
- Approval is for direction/risk, not for every leaf task. Once approved, the
  normal owner loop should keep assigning concrete work until done, stale, or
  blocked.

Expected durable shape:
- Store the active or proposed focus in the task tree as a readable branch,
  for example kind "focus_plan" with context.horizon, context.success_criteria,
  context.progress_review, and child tasks under existing domain lanes when
  possible.
- Keep the runtime project readout consistent when you make a material focus
  change.
- Keep .state/ only as scratch; durable focus understanding belongs in
  the task tree.

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
): void {
  try {
    ctx.dispatchEvent("project.planning.requested", {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      reason: `focus-plan-${input.kind}`,
      focusResult: input.result,
      focus_result: input.result,
      requested_by: "focus-plan",
      params: {
        summary: truncate(input.summary, 2400),
        instruction:
          "Review the focus-plan result, reconcile the task tree, and keep assigning work inside the approved focus when possible.",
      },
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
}

function dispatchHumanApproval(
  ctx: WorkflowContext,
  input: {
    result: FocusResult;
    kind: "proposal" | "review";
    title: string;
    summary: string;
  },
): void {
  if (input.result !== "needs_approval" && input.result !== "off_track") return;

  const plannerNext =
    extractMarker(input.summary, "OWNER_NEXT") ||
    extractMarker(input.summary, "PLANNER_NEXT");
  const title =
    input.title ||
    (input.result === "off_track"
      ? "AKS RP E2E focus is off track"
      : "AKS RP E2E focus plan needs approval");
  const planId = focusPlanId(input.kind, input.result);
  const question = approvalQuestion({ ...input, title });
  const text = approvalText({ ...input, title, plannerNext });
  const approval = {
    kind: "focus-plan",
    planId,
    focusResult: input.result,
    focusKind: input.kind,
    question,
    options: [
      {
        id: "approve",
        label: "Approve",
        effect:
          "Owner marks the focus direction approved and assigns work inside it.",
      },
      {
        id: "adjust",
        label: "Adjust",
        effect:
          "Owner updates the focus branch according to the reply before assigning work.",
      },
      {
        id: "hold",
        label: "Hold",
        effect:
          "Owner does not start the proposed direction and only keeps safe bookkeeping work.",
      },
    ],
    directEvent: {
      type: "project.approval.submitted",
      project: "aks-rp-e2e",
      projectPath: "projects/aks-rp-e2e.app",
      planId,
    },
  };

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
      requestedAction:
        "Reply to this notification with approve, adjust <changes>, or hold. The reply is emitted to projects/aks-rp-e2e.app as project.approval.submitted.",
      approval,
      focusResult: input.result,
      focusKind: input.kind,
      summary: truncate(input.summary, 3000),
      ownerNext: truncate(plannerNext, 1000),
      plannerNext: truncate(plannerNext, 1000),
      evidence: {
        focusPlanId: planId,
        appTaskTree: resolveTaskTreePath("/app/projects/aks-rp-e2e.app"),
        projectState: "/app/projects/aks-rp-e2e.app/.state/project-state.json",
        domainStatusCommand:
          "cd /app/projects/aks-rp-e2e && bun run status -- --gaps",
        kanban: "/projects/aks-rp-e2e.app/ui/kanban/",
      },
      dedupKey: `aks-rp-e2e:focus-plan:${input.result}`,
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
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
  const config = taskTreeConfig({
    appDir,
    projectDir,
    worker: agent,
    maxConcurrent: Number(field(ctx.task, "maxConcurrent") ?? 5),
  });
  const packet = planningPacket(config);

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

  const rawSummary = resultText(focusAgentResult);
  const guarded = guardFocusSummary({
    packet,
    result: focusResult(rawSummary),
    summary: rawSummary,
  });
  const summary = guarded.summary;
  const result = guarded.result;
  const title = extractMarker(summary, "FOCUS_PLAN_TITLE");
  dispatchHumanApproval(ctx, { result, kind, title, summary });
  dispatchOwnerRequested(ctx, { result, kind, summary });
  appendFocusRun(appDir, {
    kind,
    trigger_type: triggerType ?? "manual",
    result,
    title,
    summary: truncate(summary, 4000),
  });

  return ctx.done(
    `Focus-plan ${kind} completed with result ${result}. Summary: ${summary}`,
  );
}
