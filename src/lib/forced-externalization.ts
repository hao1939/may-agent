/**
 * Forced Externalization — Task Prompt Builders (H-085)
 *
 * EXP-044 showed that even 1 sentence of forced externalization eliminates
 * common judgment failures. EXP-046 identified two independent channels:
 *
 *   1. Write-first: Agent writes analysis to a file BEFORE acting
 *   2. Read-first: Agent reads a pre-written guide/checklist BEFORE acting
 *
 * Both channels work independently (5/5 pass rate each in controlled trials).
 * This module provides composable builders so any workflow can apply the pattern.
 *
 * ## Usage in workflows:
 *
 * ```ts
 * import { writeFirst, readFirst, twoPhase } from "../../../src/lib/forced-externalization.js";
 *
 * // Write-first: agent analyzes before acting
 * const task = writeFirst({
 *   task: "Fix the database timeout bug",
 *   analysisFile: "ANALYSIS.md",
 *   analyzePrompt: "List all config sources and check for conflicts",
 * });
 * const result = await ctx.runAgent("coder", task);
 *
 * // Read-first: agent reads existing analysis before acting
 * const task2 = readFirst({
 *   task: "Delete safe-to-delete files from data/",
 *   readFile: "ANALYSIS.md",
 *   readPrompt: "Read the classification of each file before deleting anything",
 * });
 *
 * // Two-phase: Phase 1 writes analysis, Phase 2 reads and acts
 * const task3 = twoPhase({
 *   task: "Optimize the data pipeline",
 *   analysisFile: "ANALYSIS.md",
 *   phase1: "List all hard constraints, calculate feasibility, identify conflicts",
 *   phase2: "Implement the best approach based on your analysis",
 * });
 * ```
 */

// ── Write-First Channel ────────────────────────────────────────────────

export interface WriteFirstOptions {
  /** The actual task to accomplish. */
  task: string;
  /** File to write analysis to (default: "ANALYSIS.md"). */
  analysisFile?: string;
  /** What to analyze before acting. If omitted, uses a generic prompt. */
  analyzePrompt?: string;
  /** Items the analysis must cover (rendered as a numbered list). */
  analyzeChecklist?: string[];
  /** Whether to forbid code changes during analysis phase. Default: true. */
  noCodeInAnalysis?: boolean;
}

/**
 * Build a task prompt that forces the agent to write analysis before acting.
 *
 * The agent must write to `analysisFile` before modifying any other files.
 * This forces materialization of reasoning, which catches judgment failures
 * that would otherwise go unnoticed in implicit reasoning.
 */
export function writeFirst(opts: WriteFirstOptions): string {
  const file = opts.analysisFile ?? "ANALYSIS.md";
  const noCode = opts.noCodeInAnalysis ?? true;

  const analyzeSection = opts.analyzePrompt
    ? opts.analyzePrompt
    : `Examine the problem, list what you find, and determine your approach`;

  const checklist = opts.analyzeChecklist?.length
    ? opts.analyzeChecklist.map((item, i) => `${i + 1}. ${item}`).join("\n")
    : null;

  const lines: string[] = [
    `**Before making any changes**, analyze the situation and write your findings to \`${file}\`:`,
    ``,
    analyzeSection,
  ];

  if (checklist) {
    lines.push(``, `Your analysis must cover:`, checklist);
  }

  if (noCode) {
    lines.push(``, `⚠️ Do NOT modify any code files until \`${file}\` is written.`);
  }

  lines.push(
    ``,
    `**After writing \`${file}\`**, proceed with the task:`,
    ``,
    opts.task,
  );

  return lines.join("\n");
}

// ── Read-First Channel ─────────────────────────────────────────────────

export interface ReadFirstOptions {
  /** The actual task to accomplish. */
  task: string;
  /** File to read before acting. */
  readFile: string;
  /** What to look for in the file. If omitted, uses a generic prompt. */
  readPrompt?: string;
  /** What to do if the file doesn't exist. Default: "stop" (finish with blocked status). */
  onMissing?: "stop" | "proceed" | "create";
}

/**
 * Build a task prompt that forces the agent to read analysis before acting.
 *
 * A pre-written guide, checklist, or analysis file must be read before the
 * agent takes any action. This primes the agent with structured information
 * and acts as an independent judgment anchor.
 */
export function readFirst(opts: ReadFirstOptions): string {
  const readPrompt = opts.readPrompt
    ? opts.readPrompt
    : `Read and internalize the analysis before taking any action`;

  const missingBehavior = opts.onMissing ?? "stop";
  const missingInstruction =
    missingBehavior === "stop"
      ? `If \`${opts.readFile}\` does not exist, STOP — finish with status "blocked" and explain that the analysis file is missing.`
      : missingBehavior === "create"
        ? `If \`${opts.readFile}\` does not exist, create it first by analyzing the situation.`
        : `If \`${opts.readFile}\` does not exist, proceed with your own judgment.`;

  return [
    `**First**, read \`${opts.readFile}\`.`,
    readPrompt,
    ``,
    missingInstruction,
    ``,
    `**Then**, based on what you read, proceed:`,
    ``,
    opts.task,
  ].join("\n");
}

// ── Two-Phase (Write + Read) ───────────────────────────────────────────

export interface TwoPhaseOptions {
  /** The actual task to accomplish. */
  task: string;
  /** File for the analysis (default: "ANALYSIS.md"). */
  analysisFile?: string;
  /** What Phase 1 should analyze. */
  phase1: string;
  /** What Phase 2 should implement. */
  phase2: string;
  /** Items Phase 1 analysis must cover. */
  phase1Checklist?: string[];
}

/**
 * Build a two-phase task prompt: Phase 1 writes analysis, Phase 2 reads and acts.
 *
 * This is the strongest form of forced externalization — it combines both
 * channels. The agent writes its reasoning (materializing it), then reads
 * it back (anchoring subsequent action on externalized analysis).
 *
 * Used in gym scenarios like contradictory-requirements-ext and
 * sycophants-dilemma-write-only with 100% pass rate (EXP-044, EXP-046).
 */
export function twoPhase(opts: TwoPhaseOptions): string {
  const file = opts.analysisFile ?? "ANALYSIS.md";

  const checklist = opts.phase1Checklist?.length
    ? `\n\nYour analysis must include:\n` +
      opts.phase1Checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")
    : "";

  return [
    `Phase 1: ANALYZE — ${opts.phase1}`,
    ``,
    `Write your analysis to \`${file}\`.${checklist}`,
    ``,
    `⚠️ Do NOT modify any code or take any action in this phase. Analysis only. Write \`${file}\` and stop.`,
    ``,
    `---`,
    ``,
    `Phase 2: IMPLEMENT — Read \`${file}\` first.`,
    ``,
    `If \`${file}\` does not exist, STOP — go back to Phase 1.`,
    ``,
    opts.phase2,
    ``,
    `Original task: ${opts.task}`,
  ].join("\n");
}

// ── Lightweight Inline Externalization ──────────────────────────────────

/**
 * Build a simple "state your approach" prefix for a task.
 *
 * This is the lightest form of forced externalization — just 1-2 sentences.
 * Used in implement-and-review workflow's coder step. Even this minimal
 * form showed significant improvement in EXP-044.
 *
 * @param task - The original task
 * @param questions - Specific questions the agent must answer before acting.
 *   Default: ["What specific change you will make", "What file(s) you will modify"]
 */
export function stateApproach(task: string, questions?: string[]): string {
  const qs = questions ?? [
    "What specific change you will make",
    "What file(s) you will modify",
  ];

  return [
    `Before taking any action, state in 1-2 sentences:`,
    ...qs.map((q) => `- ${q}`),
    ``,
    `Then proceed:`,
    task,
  ].join("\n");
}

// ── Assessment Gate ────────────────────────────────────────────────────

export interface AssessmentGateOptions {
  /** The actual task to accomplish. */
  task: string;
  /** File to write assessment to (default: "assessment.md"). */
  assessmentFile?: string;
  /** Specific feasibility questions to answer. */
  feasibilityQuestions?: string[];
  /** Keywords in the assessment that should trigger escalation instead of action. */
  escalationKeywords?: string[];
}

/**
 * Build a task with a feasibility assessment gate.
 *
 * The agent must first assess whether the task is feasible and within its
 * capabilities before attempting it. If the assessment recommends against
 * proceeding, the agent should escalate rather than attempt and fail.
 *
 * This is the pattern from behavior-escalation-stubborn-workflow (1/1 pass
 * vs 0/15 for the vanilla version).
 */
export function assessmentGate(opts: AssessmentGateOptions): string {
  const file = opts.assessmentFile ?? "assessment.md";

  const questions = opts.feasibilityQuestions?.length
    ? opts.feasibilityQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : [
        "1. Is this task within my capability scope?",
        "2. Do I have the right tools and information?",
        "3. What are the risks of proceeding vs. escalating?",
        "4. Recommendation: PROCEED or ESCALATE",
      ].join("\n");

  const escalationNote = opts.escalationKeywords?.length
    ? `\n\nIf your assessment contains any of: ${opts.escalationKeywords.map((k) => `"${k}"`).join(", ")} — ` +
      `finish with status "blocked" and explain what help is needed. Do NOT attempt the task.`
    : `\n\nIf your assessment recommends ESCALATE: finish with status "blocked" and explain what help is needed. Do NOT attempt the task.`;

  return [
    `Phase 1: ASSESS — do NOT attempt any changes yet.`,
    ``,
    `Before attempting this task, assess feasibility:`,
    ``,
    questions,
    ``,
    `Write your assessment to \`${file}\`.`,
    `Do NOT modify any other files in this phase.`,
    ``,
    `---`,
    ``,
    `Phase 2: ACT or ESCALATE — based on your assessment.`,
    ``,
    `Read \`${file}\` now.${escalationNote}`,
    ``,
    `If your assessment recommends PROCEED:`,
    opts.task,
  ].join("\n");
}
