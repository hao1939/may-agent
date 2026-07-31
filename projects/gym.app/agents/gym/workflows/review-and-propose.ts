import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  reconciliationInput,
  reconciliationPacket,
  safeKey,
  triggerDetails,
} from "./lib/trigger";

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
  return (
    candidates
      .map((candidate) => candidate.trim())
      .sort((left, right) => right.length - left.length)[0] ?? ""
  );
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

function reviewFingerprint(reviewPath: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(reviewPath)).digest("hex")}`;
}

function approvedLearningTarget(
  projectsRoot: string,
  requestKey: string,
): { benchmark: string; scenarios: string[] } | null {
  const benchmarksRoot = join(projectsRoot, "gym", "benchmarks");
  const source = `${requestKey}-approved-review`;
  const targets: Array<{ benchmark: string; scenarios: string[] }> = [];
  if (!existsSync(benchmarksRoot)) return null;
  for (const benchmark of readdirSync(benchmarksRoot).sort()) {
    const benchmarkDir = join(benchmarksRoot, benchmark);
    const suitePath = join(benchmarkDir, "suite.json");
    if (!existsSync(suitePath)) continue;
    const suite = JSON.parse(readFileSync(suitePath, "utf8")) as Record<
      string,
      unknown
    >;
    const labelsPath = join(
      benchmarkDir,
      String(suite.labels_file ?? "labels.json"),
    );
    if (!existsSync(labelsPath)) continue;
    const labelsDocument = JSON.parse(
      readFileSync(labelsPath, "utf8"),
    ) as Record<string, unknown>;
    const labels = (labelsDocument.labels ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const scenarios = (Array.isArray(suite.scenarios) ? suite.scenarios : [])
      .map(String)
      .filter(
        (scenario) =>
          labels[scenario]?.status === "approved" &&
          labels[scenario]?.source === source,
      );
    if (scenarios.length) targets.push({ benchmark, scenarios });
  }
  if (targets.length > 1) {
    throw new Error(
      `Approved review ${requestKey} maps to multiple learning benchmarks`,
    );
  }
  return targets[0] ?? null;
}

function reviewApproval(input: {
  requestKey: string;
  taskId: string;
  generation: number;
  reviewPath: string;
}) {
  const artifactFingerprint = reviewFingerprint(input.reviewPath);
  const approvalId = [
    "gym",
    "review-proposal",
    input.requestKey,
    `g${input.generation}`,
    artifactFingerprint.slice(-16),
  ].join(":");
  const waitId = `wait:${approvalId}`;
  const expectedResponse = {
    type: "project.approval.submitted",
    approvalKind: "review-proposal",
    approvalId,
    waitId,
    taskId: input.taskId,
    taskGeneration: input.generation,
    artifactFingerprint,
    acceptedDecisions: ["approve", "decline"],
  };
  return {
    approvalId,
    waitId,
    artifactFingerprint,
    expectedResponse,
    condition: {
      id: `approval-review-proposal-g${input.generation}-${artifactFingerprint.slice(-16)}`,
      type: "project.approval.submitted",
      subject: `approvalId:${approvalId}`,
      expected: {
        taskId: input.taskId,
        taskGeneration: input.generation,
        artifactFingerprint,
        acceptedDecisions: ["approve", "decline"],
      },
    },
  };
}

function approvalDecision(
  details: Record<string, unknown>,
  approval: ReturnType<typeof reviewApproval>,
  taskId: string,
  generation: number,
): "approve" | "decline" | null {
  if (details.type !== "project.approval.submitted") return null;
  if (
    details.approvalId !== approval.approvalId ||
    details.taskId !== taskId ||
    Number(details.taskGeneration) !== generation ||
    details.artifactFingerprint !== approval.artifactFingerprint
  ) {
    return null;
  }
  const decision = String(details.decision ?? "").toLowerCase();
  return decision === "approve" || decision === "decline" ? decision : null;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = triggerDetails(ctx.task);
  const input = reconciliationInput(ctx.task);
  const details = { ...(input ?? {}), ...(trigger ?? {}) };
  if (!input && !trigger) {
    return ctx.blocked("Review trigger event is missing or invalid");
  }

  const packet = reconciliationPacket(ctx.task);
  const taskId = String(packet?.taskId ?? "").trim();
  const generation = Number(packet?.generation);
  if (!taskId || !Number.isInteger(generation) || generation < 1) {
    return ctx.blocked("Review task identity is missing or invalid");
  }

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

  const approval = reviewApproval({
    requestKey,
    taskId,
    generation,
    reviewPath,
  });
  const decision = approvalDecision(details, approval, taskId, generation);

  if (decision === "approve") {
    const learningTarget = approvedLearningTarget(ctx.projectsRoot, requestKey);
    ctx.emit({
      type: "gym.review.approved",
      project: "gym",
      requestKey,
      reviewPath,
      approvalId: approval.approvalId,
      artifactFingerprint: approval.artifactFingerprint,
    });
    if (learningTarget) {
      ctx.emit({
        type: "gym.improvement.requested",
        project: "gym",
        agent: "may",
        reason: "approved-review-proposal",
        requestKey,
        reviewPath,
        incidentId: details.incidentId,
        approvalId: approval.approvalId,
        benchmark: learningTarget.benchmark,
        scenarios: learningTarget.scenarios,
      });
    }
    const summary = learningTarget
      ? `Accepted Gym review proposal ${requestKey} and started its ${learningTarget.scenarios.length}-scenario May learning target.`
      : `Accepted Gym review proposal ${requestKey}; create and approve its benchmark cases before training May.`;
    return ctx.done(summary, {
      state: learningTarget ? "converged" : "needs-owner",
      summary,
      evidence: [reviewPath, `approval:${approval.approvalId}`],
      ...(learningTarget ? { actions: [] } : {}),
    });
  }

  if (decision === "decline") {
    ctx.emit({
      type: "gym.review.declined",
      project: "gym",
      requestKey,
      reviewPath,
      approvalId: approval.approvalId,
      artifactFingerprint: approval.artifactFingerprint,
    });
    const summary = `Rejected Gym review proposal ${requestKey}; no improvement work started.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [reviewPath, `approval:${approval.approvalId}`],
      actions: [],
    });
  }

  ctx.emit({
    type: "gym.review.ready",
    project: "gym",
    kind: details.kind,
    requestKey,
    reviewPath,
    humanApprovalRequired: true,
  });
  ctx.emit({
    type: "project.approval.requested",
    project: "gym",
    taskId,
    taskGeneration: generation,
    approvalKind: "review-proposal",
    approvalId: approval.approvalId,
    waitId: approval.waitId,
    artifactFingerprint: approval.artifactFingerprint,
    packetPath: reviewPath,
    requestedAction: "Approve or reject this Gym review proposal.",
    reason: `Gym review ${requestKey} is ready for a human decision.`,
    expectedResponse: approval.expectedResponse,
  });
  const existingHumanDecision = String(details.approvedBy ?? "").trim();
  if (!existingHumanDecision) {
    ctx.dispatchEvent("message.created", {
      to: "human",
      from: "gym",
      project: "gym",
      projectId: "projects/gym.app",
      projectPath: "projects/gym.app",
      taskId,
      taskGeneration: generation,
      content: [
        "Gym review ready",
        "",
        `Review: ${reviewPath}`,
        "Decision: approve or reject this proposal.",
      ].join("\n"),
      priority: "P1",
      intent: "gym-approval",
      approval: {
        kind: "review-proposal",
        approvalId: approval.approvalId,
        waitId: approval.waitId,
        taskId,
        taskGeneration: generation,
        artifactFingerprint: approval.artifactFingerprint,
        packetPath: reviewPath,
        question: "Approve or reject this Gym review proposal.",
        directEvent: approval.expectedResponse,
      },
      approvalKind: "review-proposal",
      approvalId: approval.approvalId,
      waitId: approval.waitId,
      artifactFingerprint: approval.artifactFingerprint,
      packetPath: reviewPath,
      pathId: taskId,
      requestedAction: "Approve or reject this Gym review proposal.",
      reason: `Gym review ${requestKey} is ready for a human decision.`,
      expectedResponse: approval.expectedResponse,
      dedupKey: approval.approvalId,
    });
  }
  const summary = existingHumanDecision
    ? `Prepared Gym review proposal at ${reviewPath} and restored typed approval lineage from ${existingHumanDecision}.`
    : `Prepared Gym review proposal at ${reviewPath} and requested one typed approval.`;
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: [reviewPath],
    actions: [],
    conditions: [approval.condition],
  });
}
