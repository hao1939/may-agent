/**
 * focus-plan — slower strategy cadence for aks-rp-e2e.
 *
 * The normal planner/worker loop keeps tasks moving. This workflow periodically
 * asks the project owner to review the bigger picture, maintain one current
 * focus branch in the task tree, and request human approval when the focus
 * materially changes or drifts off track.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
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
  | "blocked";

function focusRunKind(triggerType: string | undefined): "proposal" | "review" {
  return triggerType === "project.focus.plan.requested" ? "proposal" : "review";
}

function focusSessionId(kind: "proposal" | "review"): string {
  return kind === "proposal" ? "s_focus_plan_strategy" : "s_focus_plan_review";
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
    raw === "blocked"
  ) {
    return raw;
  }
  if (/needs approval|approve this plan|approval request/i.test(text))
    return "needs_approval";
  if (/off track|not on track|stale focus/i.test(text)) return "off_track";
  if (/completed|focus done/i.test(text)) return "completed";
  return "updated";
}

function truncate(text: string, max = 1800): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
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
- Maintain one visible mid-term focus branch in tasks/tree.json.
- Keep normal planner/worker execution inside the approved focus when useful.
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
  normal planner should keep assigning concrete work until done, stale, or
  blocked.

Expected durable shape:
- Store the active or proposed focus in tasks/tree.json as a readable branch,
  for example kind "focus_plan" with context.horizon, context.success_criteria,
  context.progress_review, and child tasks under existing domain lanes when
  possible.
- Keep project.json currentFocus/focusPlan summary consistent when you make a
  material focus change.
- Keep .state/ only as scratch; durable focus understanding belongs in
  tasks/tree.json and project.json.

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
- cd ${input.appDir} && bun run metrics:sample aks-rp-e2e.model.unknown-path-count
- cd ${input.projectDir} && bun run status -- --gaps
- cd ${input.projectDir} && bun run status -- --json
- cd ${input.projectDir} && git status --short

Finish with these exact markers:

FOCUS_PLAN_RESULT: on_track | updated | needs_approval | off_track | completed | blocked
FOCUS_PLAN_TITLE: <short title>
FOCUS_PLAN_SUMMARY: <human-readable summary suitable for Telegram>
PLANNER_NEXT: <what the normal planner should do next>

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

function dispatchPlanningRequested(
  ctx: WorkflowContext,
  input: {
    result: FocusResult;
    kind: "proposal" | "review";
    summary: string;
  },
): void {
  try {
    ctx.dispatchEvent("project.planning.requested", {
      project: "aks-rp-e2e",
      reason: `focus-plan-${input.kind}`,
      focusResult: input.result,
      focus_result: input.result,
      requested_by: "focus-plan",
      params: {
        summary: truncate(input.summary, 2400),
        instruction:
          "Review the focus-plan result, reconcile tasks/tree.json, and keep assigning work inside the approved focus when possible.",
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

  const title =
    input.title ||
    (input.result === "off_track"
      ? "AKS RP E2E focus is off track"
      : "AKS RP E2E focus plan needs approval");
  const escalationId = `esc_aks_rp_e2e_focus_${input.result}_${Date.now()}`;

  try {
    ctx.dispatchEvent("escalation.created", {
      source: "project-app:aks-rp-e2e",
      owner: "human:operator",
      urgency: input.result === "off_track" ? "high" : "normal",
      project: "aks-rp-e2e",
      data: {
        escalationId,
        projectId: "aks-rp-e2e",
        sourceAgent: "aks-explorer",
        reason: title,
        requestedAction:
          "Reply approve, adjust, or hold. The planner will fold the decision into tasks/tree.json and continue the normal planner/worker loop.",
        severity: input.result === "off_track" ? "P1" : "P2",
        focusResult: input.result,
        focusKind: input.kind,
        summary: truncate(input.summary, 3000),
        evidence: {
          appTaskTree: "/app/projects/aks-rp-e2e.app/tasks/tree.json",
          domainStatusCommand:
            "cd /app/projects/aks-rp-e2e && bun run status -- --gaps",
          kanban: "/projects/aks-rp-e2e.app/ui/kanban/",
        },
        resume: {
          kind: "project-planning",
          instruction:
            "Fold the human focus-plan decision into the current focus branch, then emit project.planning.requested.",
        },
        dedupKey: `aks-rp-e2e:focus-plan:${input.result}`,
      },
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
  const kind = focusRunKind(triggerType);
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

  const summary = resultText(focusAgentResult);
  const result = focusResult(summary);
  const title = extractMarker(summary, "FOCUS_PLAN_TITLE");
  dispatchHumanApproval(ctx, { result, kind, title, summary });
  dispatchPlanningRequested(ctx, { result, kind, summary });
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
