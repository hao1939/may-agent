/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Two-Phase Workflow (Method #15 — Workflow Enforcement)
 *
 * Forces separation between analysis and action by running two separate
 * agent sessions. The agent can only communicate between phases through
 * artifacts on disk (e.g., ANALYSIS.md), preventing the common failure
 * mode of jumping straight to action without proper analysis.
 *
 * ## Task Format
 *
 * The task string should contain two phases separated by `---`:
 *
 * ```
 * agent: coder
 *
 * Phase 1: ANALYZE — do NOT modify any source files.
 * <analysis instructions>
 *
 * ---
 *
 * Phase 2: IMPLEMENT — based on your analysis.
 * <implementation instructions>
 * ```
 *
 * The `agent:` line is optional (defaults to "coder"). Place it before
 * the first phase or on any line by itself.
 *
 * ## How It Works
 *
 * 1. Parses the task into phase 1 and phase 2 instructions
 * 2. Runs phase 1 as a separate agent session (analysis only)
 * 3. Runs phase 2 as a new session (action, informed by phase 1 artifacts)
 * 4. Phase 2 gets a preamble reminding it to read phase 1 artifacts
 *
 * The key insight: because each phase is a separate session, the agent
 * cannot "remember" its phase 1 analysis — it MUST read the artifacts
 * it wrote to disk (like ANALYSIS.md), which ensures the analysis was
 * actually externalized rather than just thought about.
 *
 * ## Evidence
 *
 * Gym testing shows 92-97% pass rate with two-phase enforcement vs
 * ~50-70% single-phase for scenarios requiring careful analysis before action.
 */

export const name: string = "two-phase";

export const description: string =
  "Two-phase workflow enforcement: run analysis in one session, action in another. " +
  "Phases communicate only through artifacts on disk. " +
  "Task format: phase1 instructions, then ---, then phase2 instructions. " +
  "Optional 'agent: <name>' header (default: coder).";

// ── Task Parser ────────────────────────────────────────────────────────

interface ParsedTask {
  agent: string;
  phase1: string;
  phase2: string;
}

const SEPARATOR = /\n---\n/;
const AGENT_LINE = /^agent:\s*(\S+)\s*$/im;

function parseTask(raw: string): ParsedTask {
  // Extract optional agent declaration
  let agent = "coder";
  const agentMatch = raw.match(AGENT_LINE);
  if (agentMatch) {
    agent = agentMatch[1];
    raw = raw.replace(AGENT_LINE, "").trim();
  }

  // Split on --- separator
  const parts = raw.split(SEPARATOR);
  if (parts.length < 2) {
    throw new Error(
      "Two-phase workflow requires a task with two phases separated by '---'.\n" +
        "Expected format:\n" +
        "  Phase 1 instructions\n" +
        "  ---\n" +
        "  Phase 2 instructions",
    );
  }

  const phase1 = parts[0].trim();
  // Join remaining parts as phase 2 (in case of multiple --- separators)
  const phase2 = parts.slice(1).join("\n---\n").trim();

  if (!phase1) throw new Error("Phase 1 instructions are empty");
  if (!phase2) throw new Error("Phase 2 instructions are empty");

  return { agent, phase1, phase2 };
}

// ── Artifact Detection ─────────────────────────────────────────────────

/** Extract artifact filenames mentioned in phase 1 instructions.
 *  Looks for patterns like "Write to ANALYSIS.md" or "create report.txt". */
function extractExpectedArtifacts(phase1Text: string): string[] {
  const artifacts: string[] = [];

  // Match filenames in common patterns: "write to X.md", "create X.txt", "save to X"
  const patterns = [
    /(?:write|save|create|output)\s+(?:your\s+)?(?:analysis|findings|report|results|classification)?\s*(?:to|in|as)\s+[`"']?(\S+\.\w+)[`"']?/gi,
    /(?:write|create)\s+[`"']?(\S+\.(?:md|txt|json))[`"']?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(phase1Text)) !== null) {
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
  // Parse the task into phases
  let parsed: ParsedTask;
  try {
    parsed = parseTask(ctx.task);
  } catch (err) {
    return ctx.escalate(
      err instanceof Error ? err.message : "Failed to parse two-phase task",
      { rawTask: ctx.task.slice(0, 500) },
    );
  }

  const { agent, phase1, phase2 } = parsed;
  const artifacts = extractExpectedArtifacts(phase1);

  // ── Phase 1: Analysis ──────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "phase1-analysis" });

  const phase1Result = await ctx.runAgent(agent, phase1);

  if (phase1Result.status === "error") {
    return ctx.escalate("Phase 1 (analysis) failed", {
      agent,
      error: phase1Result.error,
      phase: 1,
    });
  }

  // ── Phase 2: Action ────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "phase2-action" });

  // Build phase 2 task with artifact reminder
  let phase2Task = phase2;

  if (artifacts.length > 0) {
    const artifactList = artifacts.map((a) => `  - \`${a}\``).join("\n");
    phase2Task =
      `IMPORTANT: Before starting, read the analysis artifacts from Phase 1:\n` +
      `${artifactList}\n` +
      `These contain the analysis from the previous phase. Base your actions on them.\n\n` +
      phase2Task;
  }

  const phase2Result = await ctx.runAgent(agent, phase2Task);

  if (phase2Result.status === "error") {
    return ctx.escalate("Phase 2 (action) failed", {
      agent,
      error: phase2Result.error,
      phase: 2,
      phase1Summary: phase1Result.lastAssistantText?.slice(0, 1000),
    });
  }

  // ── Result ─────────────────────────────────────────────────────────

  return ctx.done(
    `## Two-Phase Workflow Complete\n\n` +
      `**Agent**: ${agent}\n\n` +
      `### Phase 1: Analysis\n` +
      `${phase1Result.lastAssistantText ?? "(no output)"}\n\n` +
      `### Phase 2: Action\n` +
      `${phase2Result.lastAssistantText ?? "(no output)"}`,
  );
}
