/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Predict-then-Verify Workflow (Method #23)
 *
 * Three-phase workflow that forces the agent to commit to predictions
 * BEFORE examining the actual state, creating expectation-violation
 * signals that improve state-checking and anomaly detection.
 *
 * ## Task Format
 *
 * The task string should contain three phases separated by `---`:
 *
 * ```
 * agent: coder
 *
 * Phase 1: PREDICT — before reading any source files...
 * <prediction instructions>
 *
 * ---
 *
 * Phase 2: VERIFY — read the actual files and compare to predictions...
 * <verification instructions>
 *
 * ---
 *
 * Phase 3: ACT — based on verified findings only...
 * <action instructions>
 * ```
 *
 * ## How It Works
 *
 * 1. Phase 1: Agent writes PREDICTIONS.md with concrete, verifiable
 *    predictions about what it expects to find — BEFORE reading source.
 * 2. Phase 2: Agent reads actual files, compares to predictions, writes
 *    VERIFIED.md with prediction vs reality comparison.
 * 3. Phase 3: Agent acts ONLY on verified findings (not assumptions).
 *
 * The key insight: by committing to predictions first, the agent creates
 * an expectation that can be violated. When reality differs from prediction
 * (e.g., "predicted bug present → actually already fixed"), the violation
 * triggers correct "no action needed" recognition.
 *
 * ## Evidence
 *
 * Theoretical — Method #23 from coach method catalog. Based on JEPA
 * (expectation violation detection) and HB#2218 Pattern 5 (every-step
 * explicit verification).
 */

export const name: string = "predict-then-verify";

export const description: string =
  "Three-phase predict-then-verify workflow: predict outcomes, verify against reality, " +
  "then act on verified findings only. Phases communicate through artifacts on disk. " +
  "Task format: phase1 (predict), ---, phase2 (verify), ---, phase3 (act). " +
  "Optional 'agent: <name>' header (default: coder).";

// ── Task Parser ────────────────────────────────────────────────────────

interface ParsedTask {
  agent: string;
  phase1: string;
  phase2: string;
  phase3: string;
}

const SEPARATOR = /\n---\n/;
const AGENT_LINE = /^agent:\s*(\S+)\s*$/im;

function parseTask(raw: string): ParsedTask {
  let agent = "coder";
  const agentMatch = raw.match(AGENT_LINE);
  if (agentMatch) {
    agent = agentMatch[1];
    raw = raw.replace(AGENT_LINE, "").trim();
  }

  const parts = raw.split(SEPARATOR);
  if (parts.length < 3) {
    throw new Error(
      "Predict-then-verify workflow requires three phases separated by '---'.\n" +
        "Expected format:\n" +
        "  Phase 1: PREDICT\n" +
        "  ---\n" +
        "  Phase 2: VERIFY\n" +
        "  ---\n" +
        "  Phase 3: ACT",
    );
  }

  const phase1 = parts[0].trim();
  const phase2 = parts[1].trim();
  const phase3 = parts.slice(2).join("\n---\n").trim();

  if (!phase1) throw new Error("Phase 1 (predict) instructions are empty");
  if (!phase2) throw new Error("Phase 2 (verify) instructions are empty");
  if (!phase3) throw new Error("Phase 3 (act) instructions are empty");

  return { agent, phase1, phase2, phase3 };
}

// ── Artifact Detection ─────────────────────────────────────────────────

function extractExpectedArtifacts(phaseText: string): string[] {
  const artifacts: string[] = [];
  const patterns = [
    /(?:write|save|create|output)\s+(?:your\s+)?(?:predictions?|findings|analysis|report|results|verification)?\s*(?:to|in|as)\s+[`"']?(\S+\.\w+)[`"']?/gi,
    /(?:write|create|update)\s+[`"']?(\S+\.(?:md|txt|json))[`"']?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(phaseText)) !== null) {
      const filename = match[1].replace(/[`"'.,;:]+$/, "");
      if (!artifacts.includes(filename)) {
        artifacts.push(filename);
      }
    }
  }

  return artifacts;
}

// ── Workflow Execute ───────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  let parsed: ParsedTask;
  try {
    parsed = parseTask(ctx.task);
  } catch (err) {
    return ctx.escalate(
      err instanceof Error ? err.message : "Failed to parse predict-then-verify task",
      { rawTask: ctx.task.slice(0, 500) },
    );
  }

  const { agent, phase1, phase2, phase3 } = parsed;
  const phase1Artifacts = extractExpectedArtifacts(phase1);
  const phase2Artifacts = extractExpectedArtifacts(phase2);

  // ── Phase 1: PREDICT ───────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "phase1-predict" });

  const phase1Result = await ctx.runAgent(agent, phase1);

  if (phase1Result.status === "error") {
    return ctx.escalate("Phase 1 (predict) failed", {
      agent,
      error: phase1Result.error,
      phase: 1,
    });
  }

  // ── Phase 2: VERIFY ────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "phase2-verify" });

  let phase2Task = phase2;

  if (phase1Artifacts.length > 0) {
    const artifactList = phase1Artifacts.map((a) => `  - \`${a}\``).join("\n");
    phase2Task =
      `IMPORTANT: Before starting, read your Phase 1 predictions:\n` +
      `${artifactList}\n` +
      `Compare what you find in the actual files against these predictions.\n\n` +
      phase2Task;
  }

  const phase2Result = await ctx.runAgent(agent, phase2Task);

  if (phase2Result.status === "error") {
    return ctx.escalate("Phase 2 (verify) failed", {
      agent,
      error: phase2Result.error,
      phase: 2,
      phase1Summary: phase1Result.lastAssistantText?.slice(0, 1000),
    });
  }

  // ── Phase 3: ACT ───────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "phase3-act" });

  let phase3Task = phase3;

  const allArtifacts = [...new Set([...phase1Artifacts, ...phase2Artifacts])];
  if (allArtifacts.length > 0) {
    const artifactList = allArtifacts.map((a) => `  - \`${a}\``).join("\n");
    phase3Task =
      `IMPORTANT: Before starting, read the artifacts from previous phases:\n` +
      `${artifactList}\n` +
      `Base your actions ONLY on the verified findings in these artifacts.\n\n` +
      phase3Task;
  }

  const phase3Result = await ctx.runAgent(agent, phase3Task);

  if (phase3Result.status === "error") {
    return ctx.escalate("Phase 3 (act) failed", {
      agent,
      error: phase3Result.error,
      phase: 3,
      phase2Summary: phase2Result.lastAssistantText?.slice(0, 1000),
    });
  }

  // ── Result ─────────────────────────────────────────────────────────

  return ctx.done(
    `## Predict-then-Verify Workflow Complete\n\n` +
      `**Agent**: ${agent}\n\n` +
      `### Phase 1: Predict\n` +
      `${phase1Result.lastAssistantText ?? "(no output)"}\n\n` +
      `### Phase 2: Verify\n` +
      `${phase2Result.lastAssistantText ?? "(no output)"}\n\n` +
      `### Phase 3: Act\n` +
      `${phase3Result.lastAssistantText ?? "(no output)"}`,
  );
}
