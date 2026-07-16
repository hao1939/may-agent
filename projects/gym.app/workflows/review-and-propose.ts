import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { safeKey, triggerDetails } from "./lib/trigger";

export const name = "review-and-propose";
export const description =
  "Review Gym evidence and prepare a human-auditable benchmark proposal.";

const reviewResultSchema = Type.Object({
  proposal: Type.String({
    minLength: 200,
    description:
      "Complete Markdown proposal for human review, including classification, evidence, smallest next action, and approval boundaries.",
  }),
});

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (!block || typeof block !== "object") return "";
      const value = block as Record<string, unknown>;
      return typeof value.text === "string"
        ? value.text
        : typeof value.content === "string"
          ? value.content
          : "";
    })
    .filter(Boolean)
    .join("\n");
}

function reviewProposal(result: {
  structuredResult?: { proposal?: unknown };
  lastAssistantText?: string | null;
  messages?: unknown[];
}): string {
  const candidates = [
    typeof result.structuredResult?.proposal === "string"
      ? result.structuredResult.proposal
      : "",
    result.lastAssistantText ?? "",
  ];
  for (const message of result.messages ?? []) {
    if (!message || typeof message !== "object") continue;
    const value = message as Record<string, unknown>;
    if (value.role !== "assistant") continue;
    candidates.push(
      typeof value.text === "string" ? value.text : contentText(value.content),
    );
  }
  return candidates
    .map((candidate) => candidate.trim())
    .sort((left, right) => right.length - left.length)[0] ?? "";
}

function reviewPrompt(details: Record<string, unknown>): string {
  const kind = String(details.kind ?? "unknown");
  const evidencePath =
    kind === "incident"
      ? details.incidentPath
      : kind === "regression-runtime"
        ? details.failurePath
        : details.outcomePath;
  const runDir = typeof details.runDir === "string" ? details.runDir : "";
  return [
    "You are the Gym benchmark owner. Review evidence; do not grade or improve yourself.",
    "The standalone Gym project owns benchmark definitions and generated run evidence.",
    "This is a read-only review. Do not write files or modify May, benchmark cases, labels, Git state, or approved ground truth.",
    "Return the complete human-review proposal in your final response; the workflow owns persistence.",
    "Prepare a concise Markdown proposal for Hao. Classify the issue as May behavior, benchmark truth, scorer, harness/runtime, or not actionable.",
    "For a May behavior issue, propose: intended outcome, must/must-not rules, a replay case, a paraphrase, an opposite control, and how the old behavior would be reproduced.",
    "For a regression result, lead with failing/invalid/unapproved cases and the smallest next action.",
    "Explicitly identify every point that requires human approval.",
    `Review kind: ${kind}`,
    `Evidence path: ${String(evidencePath ?? "")}`,
    runDir ? `Run directory: ${runDir}` : "",
    "Trigger details:",
    "```json",
    JSON.stringify(details, null, 2),
    "```",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function execute(
  ctx: WorkflowContext,
): Promise<WorkflowResult> {
  const details = triggerDetails(ctx.task);
  if (!details) return ctx.blocked("Review trigger event is missing or invalid");

  const requestKey = safeKey(details.requestKey, "review");
  const reviewDir = join(ctx.projectsRoot, "gym.app", ".state", "reviews");
  const reviewPath = join(reviewDir, `${requestKey}.md`);
  mkdirSync(reviewDir, { recursive: true });

  if (!existsSync(reviewPath)) {
    const result = await ctx.runAgent("gym", reviewPrompt(details), {
      schema: reviewResultSchema,
    });
    if (result.status === "error" || result.status === "interrupted") {
      return ctx.blocked("Gym owner review failed", {
        sessionId: result.sessionId,
        status: result.status,
        summary: result.lastAssistantText,
      });
    }
    const proposal = reviewProposal(result);
    if (proposal.length < 200) {
      return ctx.blocked("Gym owner returned no complete review proposal", {
        sessionId: result.sessionId,
        proposalLength: proposal.length,
      });
    }
    writeFileSync(
      reviewPath,
      [
        "# Gym Review Proposal",
        "",
        `Request: ${requestKey}`,
        `Created: ${new Date().toISOString()}`,
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
    kind: details.kind,
    requestKey,
    reviewPath,
    humanApprovalRequired: true,
  });
  ctx.notify(`Gym review ready: ${reviewPath}`);
  return ctx.done(`Prepared Gym review proposal at ${reviewPath}.`);
}
