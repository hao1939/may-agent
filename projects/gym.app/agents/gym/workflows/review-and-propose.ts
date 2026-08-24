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
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { callGymAgent, emitGymEvent, gymProjectsRoot } from "./lib/context";
import { reviewEvent } from "./lib/review-event";
import {
  reconciliationInput,
  reconciliationPacket,
  safeKey,
  triggerDetails,
} from "./lib/trigger";

export const name = "review-and-propose";
export const description =
  "Review Gym evidence and prepare a human-auditable benchmark proposal.";

const reviewDecisionSchema = Type.Object({
  disposition: Type.Union([
    Type.Literal("human-review"),
    Type.Literal("covered"),
    Type.Literal("runtime"),
    Type.Literal("invalid"),
    Type.Literal("weak"),
  ]),
  matchedCoverage: Type.Array(Type.String()),
  dispositionReason: Type.String({ minLength: 20 }),
});

const reviewResultSchema = Type.Object({
  proposal: Type.String({
    minLength: 200,
    description:
      "Complete Markdown proposal for human review, including classification, evidence, smallest next action, and approval boundaries.",
  }),
  disposition: reviewDecisionSchema.properties.disposition,
  matchedCoverage: reviewDecisionSchema.properties.matchedCoverage,
  dispositionReason: reviewDecisionSchema.properties.dispositionReason,
});

const noveltyBoundary = [
  "Human review owns new external decision meaning and new human authority boundaries.",
  "App-internal mechanics are not May learning: path resolution, file lookup, search order, event routing, task identity, workflow choice, session choice, wake handling, tool recovery, and durable storage belong to the responsible app or runtime.",
  "Classify an app-internal mechanics issue as runtime even when the repair is new or reusable; never create a May benchmark that teaches those internals.",
].join(" ");

type ReviewDisposition =
  "human-review" | "covered" | "runtime" | "invalid" | "weak";

type ReviewDecision = {
  disposition: ReviewDisposition;
  matchedCoverage: string[];
  dispositionReason: string;
};

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

function coverageSummary(projectsRoot: string): string {
  const benchmarksRoot = join(projectsRoot, "gym", "benchmarks");
  const rows: string[] = [];
  if (existsSync(benchmarksRoot)) {
    for (const benchmark of readdirSync(benchmarksRoot).sort()) {
      const labelsPath = join(benchmarksRoot, benchmark, "labels.json");
      if (!existsSync(labelsPath)) continue;
      try {
        const document = JSON.parse(readFileSync(labelsPath, "utf8")) as Record<
          string,
          unknown
        >;
        const labels = (document.labels ?? {}) as Record<
          string,
          Record<string, unknown>
        >;
        for (const scenario of Object.keys(labels).sort()) {
          const label = labels[scenario] ?? {};
          const status = String(label.status ?? "");
          if (status !== "approved" && status !== "draft") continue;
          rows.push(
            `- ${benchmark}/${scenario} [${status}]: ${String(label.rationale ?? "No rationale recorded.")}`,
          );
        }
      } catch {
        continue;
      }
    }
  }
  const registered =
    rows.join("\n").slice(0, 16_000) ||
    "No registered scenario coverage was found.";
  const canonical: string[] = [];
  const unitsRoot = join(benchmarksRoot, "may-learning", "units");
  if (existsSync(unitsRoot)) {
    for (const unit of readdirSync(unitsRoot).sort()) {
      const lessonPath = join(unitsRoot, unit, "lesson.md");
      if (!existsSync(lessonPath)) continue;
      canonical.push(
        `### Accepted lesson: ${unit}\n${readFileSync(lessonPath, "utf8").slice(0, 2_500)}`,
      );
    }
  }
  const mayGuidancePath = join(
    projectsRoot,
    "..",
    "agents",
    "may",
    "AGENTS.md",
  );
  if (existsSync(mayGuidancePath)) {
    canonical.push(
      `### Accepted May guidance\n${readFileSync(mayGuidancePath, "utf8").slice(0, 12_000)}`,
    );
  }
  return [
    "## Registered scenario coverage",
    registered,
    "## Accepted lessons and agent guidance",
    canonical.join("\n\n").slice(0, 30_000) ||
      "No accepted lesson text was found.",
  ].join("\n");
}

function reviewPrompt(
  details: Record<string, unknown>,
  existingCoverage: string,
): string {
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
    "Also judge semantic novelty. Use human-review only when the evidence requires materially new benchmark meaning or a new human-owned boundary.",
    noveltyBoundary,
    "Use covered when approved or draft coverage already teaches the same meaning, even if wording, session, or failure details differ.",
    "Use runtime when the primary actionable issue belongs to the harness, controller, provider, or control plane; use invalid when an abort or missing evidence prevents a sound May judgment; use weak for acceptable, one-off, or non-reusable evidence.",
    "Draft coverage counts as covered so repeated incidents strengthen its evidence instead of creating more human requests.",
    "Quality is more important than quantity. A new incident is not automatically a new lesson.",
    "Existing approved/draft scenarios plus accepted lessons and agent guidance:",
    existingCoverage,
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

function noveltyPrompt(proposal: string, existingCoverage: string): string {
  return [
    "You are the Gym benchmark owner performing a semantic novelty gate.",
    "Judge meaning, not exact wording. Do not modify files or benchmark truth.",
    "Return human-review only for materially new expected behavior or a new human-owned boundary.",
    noveltyBoundary,
    "Return covered when approved or draft coverage already teaches the same behavior.",
    "Return runtime for a primary harness/controller/provider/control-plane issue, invalid when abort or missing evidence prevents a sound May judgment, and weak for acceptable or non-reusable evidence.",
    "Draft coverage counts as covered. Prefer quality over quantity.",
    "Existing approved/draft scenarios plus accepted lessons and agent guidance:",
    existingCoverage,
    "Proposal to classify:",
    proposal,
  ].join("\n");
}

function decisionFromResult(result: {
  structuredResult?: Record<string, unknown>;
}): ReviewDecision {
  const structured = result.structuredResult ?? {};
  const raw = String(structured.disposition ?? "human-review");
  const disposition: ReviewDisposition = [
    "human-review",
    "covered",
    "runtime",
    "invalid",
    "weak",
  ].includes(raw)
    ? (raw as ReviewDisposition)
    : "human-review";
  return {
    disposition,
    matchedCoverage: Array.isArray(structured.matchedCoverage)
      ? structured.matchedCoverage.map(String).filter(Boolean).slice(0, 20)
      : [],
    dispositionReason:
      String(structured.dispositionReason ?? "").trim() ||
      "Legacy review result did not include a semantic novelty disposition, so human review remains the safe default.",
  };
}

function readDecision(path: string): ReviewDecision | null {
  if (!existsSync(path)) return null;
  try {
    return decisionFromResult({
      structuredResult: JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >,
    });
  } catch {
    return null;
  }
}

function writeDecision(path: string, decision: ReviewDecision): void {
  writeFileSync(path, `${JSON.stringify(decision, null, 2)}\n`, "utf8");
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

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const trigger = triggerDetails(ctx);
  const input = reconciliationInput(ctx);
  const details = { ...(input ?? {}), ...(trigger ?? {}) };
  if (!input && !trigger) {
    return ctx.blocked("Review trigger event is missing or invalid");
  }

  const packet = reconciliationPacket(ctx);
  const taskId = String(packet?.taskId ?? "").trim();
  const generation = Number(packet?.generation);
  if (!taskId || !Number.isInteger(generation) || generation < 1) {
    return ctx.blocked("Review task identity is missing or invalid");
  }

  const requestKey = safeKey(details.requestKey, "review");
  const reviewDir = join(gymProjectsRoot(ctx), "gym.app", ".state", "reviews");
  const reviewPath = join(reviewDir, `${requestKey}.md`);
  const decisionPath = join(reviewDir, `${requestKey}.decision.json`);
  mkdirSync(reviewDir, { recursive: true });
  const existingCoverage = coverageSummary(gymProjectsRoot(ctx));
  const forceNoveltyRecheck = details.forceNoveltyRecheck === true;
  let decision = forceNoveltyRecheck ? null : readDecision(decisionPath);

  if (!existsSync(reviewPath)) {
    const result = await callGymAgent(ctx,
      "gym",
      reviewPrompt(details, existingCoverage),
      {
        schema: reviewResultSchema,
      },
    );
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
    decision = decisionFromResult(result);
    writeDecision(decisionPath, decision);
  } else if (!decision && details.type === "project.approval.submitted") {
    decision = {
      disposition: "human-review",
      matchedCoverage: [],
      dispositionReason:
        "This legacy proposal already has an exact human response; preserve that authority instead of reclassifying it.",
    };
    writeDecision(decisionPath, decision);
  } else if (!decision) {
    const result = await callGymAgent(ctx,
      "gym",
      noveltyPrompt(readFileSync(reviewPath, "utf8"), existingCoverage),
      { schema: reviewDecisionSchema },
    );
    if (result.status === "error" || result.status === "interrupted") {
      return ctx.blocked("Gym semantic novelty review failed", {
        sessionId: result.sessionId,
        status: result.status,
        summary: result.lastAssistantText,
      });
    }
    decision = decisionFromResult(result);
    writeDecision(decisionPath, decision);
  }

  decision ??= {
    disposition: "human-review",
    matchedCoverage: [],
    dispositionReason: "No semantic novelty decision was available.",
  };

  const approval = reviewApproval({
    requestKey,
    taskId,
    generation,
    reviewPath,
  });

  if (decision.disposition !== "human-review") {
    await emitGymEvent(
      ctx,
      reviewEvent(ctx, "filtered", "gym.review.filtered", {
        kind: details.kind,
        requestKey,
        reviewPath,
        decisionPath,
        disposition: decision.disposition,
        matchedCoverage: decision.matchedCoverage,
        reason: decision.dispositionReason,
      }),
    );
    await emitGymEvent(
      ctx,
      reviewEvent(ctx, "approval-superseded", "project.approval.resolved", {
        approvalKind: "review-proposal",
        approvalId: approval.approvalId,
        waitId: approval.waitId,
        taskId,
        taskGeneration: generation,
        artifactFingerprint: approval.artifactFingerprint,
        resolution: "superseded",
        disposition: decision.disposition,
        reason: decision.dispositionReason,
      }),
    );
    const matched = decision.matchedCoverage.length
      ? ` Coverage: ${decision.matchedCoverage.join(", ")}.`
      : "";
    const summary = `Filed Gym review ${requestKey} as ${decision.disposition}; no human decision requested.${matched}`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [reviewPath, decisionPath],
      actions: [],
    });
  }

  const humanDecision = approvalDecision(details, approval, taskId, generation);

  if (humanDecision === "approve") {
    const learningTarget = approvedLearningTarget(gymProjectsRoot(ctx), requestKey);
    await emitGymEvent(
      ctx,
      reviewEvent(ctx, "approved", "gym.review.approved", {
        requestKey,
        reviewPath,
        approvalId: approval.approvalId,
        artifactFingerprint: approval.artifactFingerprint,
      }),
    );
    if (learningTarget) {
      await emitGymEvent(
        ctx,
        reviewEvent(ctx, "improvement-requested", "gym.improvement.requested", {
          agent: "may",
          reason: "approved-review-proposal",
          requestKey,
          reviewPath,
          incidentId: details.incidentId,
          approvalId: approval.approvalId,
          benchmark: learningTarget.benchmark,
          scenarios: learningTarget.scenarios,
        }),
      );
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

  if (humanDecision === "decline") {
    await emitGymEvent(
      ctx,
      reviewEvent(ctx, "declined", "gym.review.declined", {
        requestKey,
        reviewPath,
        approvalId: approval.approvalId,
        artifactFingerprint: approval.artifactFingerprint,
      }),
    );
    const summary = `Rejected Gym review proposal ${requestKey}; no improvement work started.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [reviewPath, `approval:${approval.approvalId}`],
      actions: [],
    });
  }

  await emitGymEvent(
    ctx,
    reviewEvent(ctx, "ready", "gym.review.ready", {
      kind: details.kind,
      requestKey,
      reviewPath,
      humanApprovalRequired: true,
    }),
  );
  await emitGymEvent(
    ctx,
    reviewEvent(ctx, "approval-requested", "project.approval.requested", {
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
    }),
  );
  const existingHumanDecision = String(details.approvedBy ?? "").trim();
  if (!existingHumanDecision) {
    await emitGymEvent(
      ctx,
      reviewEvent(
        ctx,
        "human-message",
        "message.created",
        {
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
        },
        { target: { human: true } },
      ),
    );
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
