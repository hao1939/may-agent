/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * Evidence Gate Workflow
 *
 * Checks whether a design brief contains sufficient evidence before
 * allowing it to proceed. Designed for architecture/design briefs where
 * the common failure mode is proposing systems before validating assumptions.
 *
 * ## Task Format
 *
 * The task string is the full text of a brief/design doc to evaluate.
 * Optional header: `returnPath: <agent>` to specify who gets the feedback.
 *
 * ## How It Works
 *
 * 1. Parse the brief text from the task
 * 2. Send to evaluator (cheap model) with a rubric checking for:
 *    - Specific incidents or data cited (not just "failures happen")
 *    - A simpler alternative considered
 *    - A POC/experiment to validate the core assumption
 * 3. If all three are present → pass (return the brief text)
 * 4. If any are missing → reject with specific feedback on what's needed
 *
 * ## Evidence
 *
 * Audit of 47 Bob briefs (2026-03-27) found:
 * - 4 pure theory-first briefs (all architecture/design docs)
 * - 18 mixed briefs (evidence for problem, speculation for solution)
 * - Pattern: design briefs propose systems before validating core assumption
 * - Reviews, experiments, and deployment briefs are already evidence-disciplined
 */

export const name: string = "evidence-gate";

export const description: string =
  "Check a design brief for evidence before it proceeds. " +
  "Evaluates: (1) specific incidents cited, (2) simpler alternative considered, " +
  "(3) POC/experiment proposed. Returns PASS or REJECT with feedback.";

// ── Constants ──────────────────────────────────────────────────────────

const EVIDENCE_CHECK_PROMPT = `You are an evidence auditor for design briefs. Your job is to check whether a brief contains sufficient evidence before it should proceed to implementation.

## Rubric

Check for these THREE elements:

### 1. Specific Incidents (REQUIRED)
Does the brief cite SPECIFIC evidence? This means:
- Session IDs, error counts, or incident references
- Grep output, log data, or evaluation results
- Concrete examples with details (not just "agents sometimes fail at X")

PASS examples: "Session s_123 failed with FM-3.3", "grep found 12 agents missing this config", "Gym pass rate dropped from 80% to 60%"
FAIL examples: "Agents often struggle with X", "This is a common failure mode", "Based on our experience"

### 2. Simpler Alternative Considered (REQUIRED)
Does the brief mention a simpler approach and explain why it's insufficient?
- A prompt change, a single guard, a manual process — anything less complex than the proposed system
- Why that simpler thing won't work or has been tried and failed

PASS examples: "We tried adding a SOUL.md instruction but gym showed 0/18 improvement", "A simple grep guard won't work because the pattern requires semantic understanding"
FAIL examples: No mention of alternatives at all, or jumping straight to the complex solution

### 3. Validation Plan (REQUIRED)
Does the brief include a way to test the core assumption?
- A POC, experiment, A/B test, or gym scenario
- Specific success criteria (not just "we'll see if it works")

PASS examples: "Run gym scenario X with and without this change, measure pass rate", "POC: build the simplest version, test on 3 real sessions"
FAIL examples: No validation mentioned, or "we'll monitor after deployment"

## Output Format

You MUST output EXACTLY this format (no other text):

EVIDENCE_1: PASS|FAIL — <one-line explanation>
EVIDENCE_2: PASS|FAIL — <one-line explanation>
EVIDENCE_3: PASS|FAIL — <one-line explanation>
VERDICT: PASS|REJECT
FEEDBACK: <If REJECT: 2-3 sentences explaining what specific evidence is needed. If PASS: "Brief is evidence-backed.">`;

// ── Task Parser ────────────────────────────────────────────────────────

interface ParsedTask {
  returnAgent: string;
  briefText: string;
}

const RETURN_PATH_LINE = /^returnPath:\s*(\S+)\s*$/im;

function parseTask(raw: string): ParsedTask {
  let returnAgent = "bob";

  const returnMatch = raw.match(RETURN_PATH_LINE);
  if (returnMatch) {
    returnAgent = returnMatch[1];
    raw = raw.replace(RETURN_PATH_LINE, "").trim();
  }

  const briefText = raw.trim();
  if (!briefText) {
    throw new Error("Evidence-gate workflow requires brief text to evaluate.");
  }

  return { returnAgent, briefText };
}

// ── Response Parser ────────────────────────────────────────────────────

interface GateResult {
  evidence1: { pass: boolean; explanation: string };
  evidence2: { pass: boolean; explanation: string };
  evidence3: { pass: boolean; explanation: string };
  verdict: "PASS" | "REJECT";
  feedback: string;
}

function parseResponse(response: string): GateResult | null {
  const lines = response.split("\n").map(l => l.trim()).filter(Boolean);

  const parseLine = (prefix: string): { pass: boolean; explanation: string } | null => {
    const line = lines.find(l => l.startsWith(prefix));
    if (!line) return null;
    const pass = line.includes("PASS");
    const explanation = line.replace(prefix, "").replace(/^(PASS|FAIL)\s*—?\s*/, "").trim();
    return { pass, explanation };
  };

  const e1 = parseLine("EVIDENCE_1:");
  const e2 = parseLine("EVIDENCE_2:");
  const e3 = parseLine("EVIDENCE_3:");

  if (!e1 || !e2 || !e3) return null;

  const verdictLine = lines.find(l => l.startsWith("VERDICT:"));
  if (!verdictLine) return null;
  const verdict = verdictLine.includes("PASS") ? "PASS" as const : "REJECT" as const;

  const feedbackLine = lines.find(l => l.startsWith("FEEDBACK:"));
  const feedback = feedbackLine
    ? feedbackLine.replace("FEEDBACK:", "").trim()
    : (verdict === "PASS" ? "Brief is evidence-backed." : "Missing evidence — see above.");

  return { evidence1: e1, evidence2: e2, evidence3: e3, verdict, feedback };
}

// ── Workflow Execute ───────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Parse ──────────────────────────────────────────────────────────

  let parsed: ParsedTask;
  try {
    parsed = parseTask(ctx.task);
  } catch (err) {
    return ctx.escalate(
      err instanceof Error ? err.message : "Failed to parse evidence-gate task",
    );
  }

  const { briefText } = parsed;

  // Cap input for the LLM
  const cappedBrief = briefText.length > 6000
    ? briefText.slice(0, 3000) + "\n\n[... truncated ...]\n\n" + briefText.slice(-3000)
    : briefText;

  // ── Evaluate ───────────────────────────────────────────────────────

  ctx.emit({ type: "step_start", step: "evidence-check" });

  const prompt = [
    EVIDENCE_CHECK_PROMPT,
    "",
    "## Brief to Evaluate",
    "",
    cappedBrief,
  ].join("\n");

  const evalResult = await ctx.runAgent("evaluator", prompt);

  if (evalResult.status === "error") {
    return ctx.escalate("Evidence check failed", {
      error: evalResult.error,
    });
  }

  const responseText = evalResult.lastAssistantText ?? "";
  const gateResult = parseResponse(responseText);

  if (!gateResult) {
    return ctx.escalate("Could not parse evaluator response", {
      response: responseText.slice(0, 500),
    });
  }

  // ── Result ─────────────────────────────────────────────────────────

  const status = gateResult.verdict === "PASS" ? "✅ PASSED" : "❌ REJECTED";

  const summary = [
    `## Evidence Gate: ${status}`,
    "",
    `| Check | Result | Detail |`,
    `|-------|--------|--------|`,
    `| Specific incidents | ${gateResult.evidence1.pass ? "✅" : "❌"} | ${gateResult.evidence1.explanation} |`,
    `| Simpler alternative | ${gateResult.evidence2.pass ? "✅" : "❌"} | ${gateResult.evidence2.explanation} |`,
    `| Validation plan | ${gateResult.evidence3.pass ? "✅" : "❌"} | ${gateResult.evidence3.explanation} |`,
    "",
    `**Verdict**: ${gateResult.verdict}`,
    `**Feedback**: ${gateResult.feedback}`,
  ].join("\n");

  return ctx.done(summary);
}
