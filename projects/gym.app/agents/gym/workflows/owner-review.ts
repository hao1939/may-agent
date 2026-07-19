import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { safeKey } from "./lib/trigger";

export const name = "owner-review";
export const description =
  "Preserve a bounded Gym-owner proposal when a task workflow cannot converge.";

const resultSchema = Type.Object({
  proposal: Type.String({
    minLength: 160,
    description:
      "A complete Markdown exception review with evidence, classification, safest next action, and human approval boundaries.",
  }),
});

function section(task: string, heading: string): Record<string, unknown> {
  const marker = `## ${heading}`;
  const start = task.indexOf(marker);
  if (start < 0) return {};
  const after = task.slice(start + marker.length);
  const open = after.indexOf("```json");
  if (open < 0) return {};
  const json = after.slice(open + "```json".length);
  const close = json.indexOf("```");
  if (close < 0) return {};
  try {
    const value = JSON.parse(json.slice(0, close).trim());
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const reconciliation = section(ctx.task, "Reconciliation Task");
  const trigger = section(ctx.task, "Trigger Event");
  const taskId = safeKey(reconciliation.taskId, "unknown-task");
  const generation = Number(reconciliation.generation ?? 0);
  const requestKey = `workflow-exception-${taskId}-${generation}`;
  const reviewDir = join(ctx.projectsRoot, "gym.app", ".state", "reviews");
  const reviewPath = join(reviewDir, `${requestKey}.md`);
  mkdirSync(reviewDir, { recursive: true });

  if (!existsSync(reviewPath)) {
    const prompt = [
      "You are the accountable Gym owner reviewing a workflow exception.",
      "Do not modify May, Gym benchmark truth, labels, evidence, task state, or Git state.",
      "Inspect the supplied task and trigger. Classify whether this is invalid input, harness/runtime failure, benchmark issue, May behavior, or not actionable.",
      "Return a bounded Markdown proposal with concrete evidence, the safest next action, and every human approval boundary.",
      "Reconciliation task:",
      "```json",
      JSON.stringify(reconciliation, null, 2),
      "```",
      "Trigger event:",
      "```json",
      JSON.stringify(trigger, null, 2),
      "```",
    ].join("\n");
    const result = await ctx.runAgent("gym", prompt, { schema: resultSchema });
    if (result.status === "error" || result.status === "interrupted") {
      return ctx.blocked("Gym owner exception review failed", {
        sessionId: result.sessionId,
        status: result.status,
      });
    }
    const proposal = String(result.structuredResult?.proposal ?? "").trim();
    if (proposal.length < 160) {
      return ctx.blocked("Gym owner returned no complete exception proposal", {
        sessionId: result.sessionId,
        proposalLength: proposal.length,
      });
    }
    writeFileSync(
      reviewPath,
      [
        "# Gym Workflow Exception Review",
        "",
        `Task: ${taskId}`,
        `Generation: ${generation}`,
        `Review session: ${result.sessionId}`,
        "",
        proposal,
        "",
      ].join("\n"),
    );
  }

  ctx.emit({
    type: "gym.review.ready",
    project: "gym",
    kind: "workflow-exception",
    requestKey,
    reviewPath,
    humanApprovalRequired: true,
  });
  ctx.notify(`Gym workflow exception review ready: ${reviewPath}`);
  const summary = `Preserved Gym workflow exception review at ${reviewPath}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [reviewPath],
    actions: [],
  });
}
