import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";

export const name = "evaluation-feedback-projection";
export const description =
  "Project the latest durable evaluation fact into the evaluated agent's generated feedback context.";

export type EvaluationFeedback = {
  sessionId: string;
  agent: string;
  quality: number;
  verdict: string;
  issues: string[];
  overall?: {
    evidence?: string | string[];
  };
  createdAt?: number;
};

const ACTIONABLE_VERDICTS = new Set([
  "acceptable",
  "needs_improvement",
  "low_quality",
]);

function isActionableEvaluation(evaluation: EvaluationFeedback): boolean {
  return ACTIONABLE_VERDICTS.has(evaluation.verdict.trim().toLowerCase());
}

type EvaluationFeedbackInput = {
  evaluation: EvaluationFeedback;
  feedbackKey: string;
  exactReplay?: boolean;
};

type FeedbackTarget = {
  feedbackPath: string;
  projectionStatePath: string;
};

function manifestDeclaredAgentDir(
  workspaceRoot: string,
  agentName: string,
): string | null {
  if (!basename(workspaceRoot).endsWith(".app")) return null;
  const projectsRoot = dirname(workspaceRoot);
  const appRoots = readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => join(projectsRoot, entry.name))
    .sort();
  for (const appRoot of appRoots) {
    const agentsRoot = join(appRoot, "agents");
    if (!existsSync(agentsRoot)) continue;
    for (const entry of readdirSync(agentsRoot, { withFileTypes: true })
      .filter((candidate) => candidate.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const agentDir = join(agentsRoot, entry.name);
      const manifestPath = join(agentDir, "agent.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          name?: unknown;
        };
        if (manifest.name === agentName) return agentDir;
      } catch {
        // An invalid manifest is not an active target.
      }
    }
  }
  return null;
}

export function canonicalFeedbackTarget(
  workspaceRoot: string,
  feedbackKey: string,
): FeedbackTarget | null {
  const projectionStatePath = join(
    workspaceRoot,
    "generated",
    "agent-feedback",
    ".state",
    `${feedbackKey}.json`,
  );
  const workspaceAgentDir = join(workspaceRoot, "agents", feedbackKey);
  if (existsSync(join(workspaceAgentDir, "agent.json"))) {
    return {
      feedbackPath: join(workspaceAgentDir, "last-eval.md"),
      projectionStatePath,
    };
  }

  const manifestAgentDir = manifestDeclaredAgentDir(workspaceRoot, feedbackKey);
  if (manifestAgentDir) {
    return {
      feedbackPath: join(manifestAgentDir, "last-eval.md"),
      projectionStatePath,
    };
  }

  const projectsRoot = dirname(workspaceRoot);
  const appRootByAgent: Record<string, string> = {
    "aks-reviewer": join(projectsRoot, "aks-rp-e2e.app"),
    "app-ops": join(projectsRoot, "aks-rp-e2e.app"),
    owner: join(projectsRoot, "aks-rp-e2e.app"),
    evaluator: workspaceRoot,
    judge: workspaceRoot,
    gym: join(projectsRoot, "gym.app"),
    "gym-implementer": join(projectsRoot, "gym.app"),
    scout: join(projectsRoot, "scout-knowledge-lib.app"),
  };
  const appRoot = appRootByAgent[feedbackKey];
  const agentDir = appRoot
    ? join(appRoot, "agents", feedbackKey)
    : feedbackKey === "may"
      ? join(dirname(projectsRoot), "agents", "may")
      : "";
  if (!agentDir || !existsSync(join(agentDir, "agent.json"))) return null;
  return {
    feedbackPath: join(agentDir, "last-eval.md"),
    projectionStatePath,
  };
}

function validEvaluation(value: EvaluationFeedback): boolean {
  return Boolean(
    value &&
    typeof value.sessionId === "string" &&
    value.sessionId.trim() &&
    typeof value.agent === "string" &&
    value.agent.trim() &&
    typeof value.verdict === "string" &&
    value.verdict.trim() &&
    typeof value.quality === "number" &&
    Number.isFinite(value.quality) &&
    Array.isArray(value.issues),
  );
}

export function projectEvaluationFeedback(
  workspaceRoot: string,
  feedbackKey: string,
  evaluation: EvaluationFeedback,
  target?: FeedbackTarget,
  exactReplay = false,
): {
  disposition: "invalid-input" | "invalid-key" | "accepted";
  changed: boolean;
  summary: string;
  evidence: string[];
} {
  if (!validEvaluation(evaluation)) {
    return {
      disposition: "invalid-input",
      changed: false,
      summary: "Evaluation feedback input is invalid; no projection changed.",
      evidence: ["feedback-input:invalid"],
    };
  }

  if (
    !/^[A-Za-z0-9._-]+$/.test(feedbackKey) ||
    feedbackKey === "." ||
    feedbackKey === ".."
  ) {
    return {
      disposition: "invalid-key",
      changed: false,
      summary: `Feedback key for ${evaluation.agent} is invalid; no projection changed.`,
      evidence: ["feedback-key:invalid"],
    };
  }

  const feedbackDir = join(workspaceRoot, "generated", "agent-feedback");
  const feedbackPath =
    target?.feedbackPath ?? join(feedbackDir, `${feedbackKey}.md`);
  const projectionStatePath =
    target?.projectionStatePath ??
    join(feedbackDir, ".state", `${feedbackKey}.json`);
  const createdAt =
    typeof evaluation.createdAt === "number" &&
    Number.isFinite(evaluation.createdAt)
      ? evaluation.createdAt
      : Date.now();
  let projectedCreatedAt = Number.NEGATIVE_INFINITY;
  if (existsSync(projectionStatePath)) {
    try {
      const state = JSON.parse(readFileSync(projectionStatePath, "utf8")) as {
        createdAt?: unknown;
      };
      if (
        typeof state.createdAt === "number" &&
        Number.isFinite(state.createdAt)
      ) {
        projectedCreatedAt = state.createdAt;
      }
    } catch {
      // A malformed generated receipt is repaired by the next valid projection.
    }
  } else if (existsSync(feedbackPath)) {
    const priorWhen = readFileSync(feedbackPath, "utf8").match(
      /^\*\*When:\*\* (.+)$/m,
    )?.[1];
    const parsedWhen = priorWhen ? Date.parse(priorWhen) : Number.NaN;
    if (Number.isFinite(parsedWhen)) projectedCreatedAt = parsedWhen;
  }
  if (!exactReplay && createdAt < projectedCreatedAt) {
    return {
      disposition: "accepted",
      changed: false,
      summary: `Ignored stale evaluation ${evaluation.sessionId}; a newer projection already exists for ${evaluation.agent}.`,
      evidence: [
        `evaluated-session:${evaluation.sessionId}`,
        `feedback-stale:${evaluation.agent}`,
      ],
    };
  }
  const recordProjectionState = () => {
    const receipt = `${JSON.stringify({ sessionId: evaluation.sessionId, createdAt })}\n`;
    if (
      existsSync(projectionStatePath) &&
      readFileSync(projectionStatePath, "utf8") === receipt
    ) {
      return;
    }
    mkdirSync(dirname(projectionStatePath), { recursive: true });
    writeFileSync(projectionStatePath, receipt, "utf8");
  };
  const verifyProjectionState = () => {
    const state = JSON.parse(readFileSync(projectionStatePath, "utf8")) as {
      sessionId?: unknown;
      createdAt?: unknown;
    };
    if (
      state.sessionId !== evaluation.sessionId ||
      state.createdAt !== createdAt
    ) {
      throw new Error(
        `Canonical feedback state read-back failed for ${evaluation.agent}.`,
      );
    }
  };
  const issues = evaluation.issues
    .map((issue) => String(issue).trim())
    .filter(Boolean)
    .slice(0, 20);
  const actionable = isActionableEvaluation(evaluation) && issues.length > 0;
  if (!actionable) {
    if (existsSync(feedbackPath)) {
      unlinkSync(feedbackPath);
      recordProjectionState();
      verifyProjectionState();
      if (existsSync(feedbackPath)) {
        throw new Error(
          `Canonical feedback removal read-back failed for ${evaluation.agent}.`,
        );
      }
      return {
        disposition: "accepted",
        changed: true,
        summary: `Removed stale generated feedback for ${evaluation.agent}; the latest evaluation is not actionable.`,
        evidence: [
          `evaluated-session:${evaluation.sessionId}`,
          `feedback-removed:${evaluation.agent}`,
          `feedback-verified:${evaluation.agent}`,
        ],
      };
    }
    recordProjectionState();
    verifyProjectionState();
    return {
      disposition: "accepted",
      changed: false,
      summary: `Latest evaluation for ${evaluation.agent} is not actionable and no stale projection exists.`,
      evidence: [
        `evaluated-session:${evaluation.sessionId}`,
        `feedback-verified:${evaluation.agent}`,
      ],
    };
  }

  const rawVerificationEvidence = evaluation.overall?.evidence;
  const verificationEvidence = (
    Array.isArray(rawVerificationEvidence)
      ? rawVerificationEvidence
      : typeof rawVerificationEvidence === "string"
        ? [rawVerificationEvidence]
        : []
  )
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
  const verificationContext = verificationEvidence.length
    ? `\n## Verification Context\n\n${verificationEvidence
        .map((item) => `- ${item}`)
        .join("\n")}\n`
    : "";
  const content = `# Last Evaluation Feedback
<!-- Auto-generated by evaluation.app. Do not edit manually. -->

**Latest session:** ${evaluation.sessionId}
**Verdict:** ${evaluation.verdict} (quality: ${evaluation.quality})
**When:** ${new Date(createdAt).toISOString()}
**Delivery status:** Delivered to the responsible project owner; remediation remains unresolved.

## Issues Flagged

${issues.map((issue) => `- ${issue}`).join("\n")}
${verificationContext}
## Action Required

Review these issues before starting work. Adapt your approach to avoid repeating
them, and acknowledge relevant feedback in your plan.
`;
  const previous = existsSync(feedbackPath)
    ? readFileSync(feedbackPath, "utf8")
    : "";
  if (previous === content) {
    recordProjectionState();
    verifyProjectionState();
    if (readFileSync(feedbackPath, "utf8") !== content) {
      throw new Error(
        `Canonical feedback content read-back failed for ${evaluation.agent}.`,
      );
    }
    return {
      disposition: "accepted",
      changed: false,
      summary: `Evaluation ${evaluation.sessionId} was already delivered to ${evaluation.agent}'s responsible project owner and remains unresolved; exact replay made no mutation.`,
      evidence: [
        `evaluated-session:${evaluation.sessionId}`,
        `feedback-verified:${evaluation.agent}`,
      ],
    };
  }
  mkdirSync(dirname(feedbackPath), { recursive: true });
  writeFileSync(feedbackPath, content, "utf8");
  recordProjectionState();
  verifyProjectionState();
  if (readFileSync(feedbackPath, "utf8") !== content) {
    throw new Error(
      `Canonical feedback content read-back failed for ${evaluation.agent}.`,
    );
  }
  return {
    disposition: "accepted",
    changed: true,
    summary: `Delivered evaluation ${evaluation.sessionId} to ${evaluation.agent}'s responsible project owner; remediation remains unresolved.`,
    evidence: [
      `evaluated-session:${evaluation.sessionId}`,
      `feedback-updated:${evaluation.agent}`,
      `feedback-verified:${evaluation.agent}`,
    ],
  };
}

function reconciled(summary: string, evidence: string[]): TaskReconcileResult {
  return { state: "converged", summary, facts: evidence, actions: [] };
}

function evaluationVerificationEvidence(
  evaluation: EvaluationFeedback,
): string[] {
  const rawEvidence = evaluation.overall?.evidence;
  return (
    Array.isArray(rawEvidence)
      ? rawEvidence
      : typeof rawEvidence === "string"
        ? [rawEvidence]
        : []
  )
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((item) => `evaluation-verification:${item}`);
}

function reconcileMissingNonActionableTarget(
  workspaceRoot: string,
  feedbackKey: string,
  evaluation: EvaluationFeedback,
): { summary: string; evidence: string[] } {
  const projectionStatePath = join(
    workspaceRoot,
    "generated",
    "agent-feedback",
    ".state",
    `${feedbackKey}.json`,
  );
  const createdAt =
    typeof evaluation.createdAt === "number" &&
    Number.isFinite(evaluation.createdAt)
      ? evaluation.createdAt
      : Date.now();
  let projectedCreatedAt = Number.NEGATIVE_INFINITY;
  if (existsSync(projectionStatePath)) {
    try {
      const state = JSON.parse(readFileSync(projectionStatePath, "utf8")) as {
        createdAt?: unknown;
      };
      if (
        typeof state.createdAt === "number" &&
        Number.isFinite(state.createdAt)
      ) {
        projectedCreatedAt = state.createdAt;
      }
    } catch {
      // A malformed generated receipt is repaired by this valid no-op.
    }
  }
  const evidence = [
    `evaluated-session:${evaluation.sessionId}`,
    `feedback-target:missing:${feedbackKey}`,
    `feedback-target-verified:${feedbackKey}`,
  ];
  if (createdAt < projectedCreatedAt) {
    return {
      summary: `Ignored stale non-actionable evaluation ${evaluation.sessionId}; no canonical active feedback target exists for ${feedbackKey} and no delivery work is required.`,
      evidence: [...evidence, `feedback-stale:${evaluation.agent}`],
    };
  }
  mkdirSync(dirname(projectionStatePath), { recursive: true });
  const receipt = `${JSON.stringify({ sessionId: evaluation.sessionId, createdAt })}\n`;
  if (
    !existsSync(projectionStatePath) ||
    readFileSync(projectionStatePath, "utf8") !== receipt
  ) {
    writeFileSync(projectionStatePath, receipt, "utf8");
  }
  if (readFileSync(projectionStatePath, "utf8") !== receipt) {
    throw new Error(
      `Missing-target no-op receipt read-back failed for ${evaluation.agent}.`,
    );
  }
  return {
    summary: `Latest evaluation ${evaluation.sessionId} for ${evaluation.agent} is non-actionable; no canonical active feedback target exists for ${feedbackKey}, so there is no feedback or owner work to deliver.`,
    evidence,
  };
}

export async function execute(
  ctx: WorkflowContext<EvaluationFeedbackInput>,
): Promise<ExecutionResult> {
  if (!ctx.workspace?.root) {
    return ctx.blocked(
      "evaluation-feedback-projection requires an allocated App workspace",
    );
  }
  if (!validEvaluation(ctx.input.evaluation)) {
    return ctx.blocked(
      "Evaluation feedback input is invalid; no projection changed.",
      ["feedback-input:invalid"],
    );
  }
  if (
    !/^[A-Za-z0-9._-]+$/.test(ctx.input.feedbackKey) ||
    ctx.input.feedbackKey === "." ||
    ctx.input.feedbackKey === ".."
  ) {
    return ctx.blocked(
      `Feedback key for ${ctx.input.evaluation.agent} is invalid; no projection changed.`,
      ["feedback-key:invalid"],
    );
  }
  const target = canonicalFeedbackTarget(
    ctx.workspace.root,
    ctx.input.feedbackKey,
  );
  if (!target) {
    const issues = ctx.input.evaluation.issues
      .map((issue) => String(issue).trim())
      .filter(Boolean);
    const actionable =
      isActionableEvaluation(ctx.input.evaluation) && issues.length > 0;
    if (actionable) {
      return ctx.blocked(
        `Actionable evaluation ${ctx.input.evaluation.sessionId} cannot be delivered because no canonical active feedback target exists for ${ctx.input.feedbackKey}; the finding remains unresolved.`,
        [
          `evaluated-session:${ctx.input.evaluation.sessionId}`,
          `feedback-target:missing:${ctx.input.feedbackKey}`,
          `feedback-target-verified:${ctx.input.feedbackKey}`,
          ...evaluationVerificationEvidence(ctx.input.evaluation),
        ],
      );
    }
    const outcome = reconcileMissingNonActionableTarget(
      ctx.workspace.root,
      ctx.input.feedbackKey,
      ctx.input.evaluation,
    );
    return ctx.done(
      outcome.summary,
      reconciled(outcome.summary, outcome.evidence),
    );
  }
  const outcome = projectEvaluationFeedback(
    ctx.workspace.root,
    ctx.input.feedbackKey,
    ctx.input.evaluation,
    target,
    ctx.input.exactReplay === true,
  );
  if (outcome.disposition !== "accepted") {
    return ctx.blocked(outcome.summary, outcome.evidence);
  }
  return ctx.done(
    outcome.summary,
    reconciled(outcome.summary, outcome.evidence),
  );
}
