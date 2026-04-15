# Patch: Heuristic Evaluation for Root Sessions
**Author:** Optimizer  
**Date:** 2026-03-17T18:10Z  
**Priority:** HIGH — clears 10,113 backlog sessions immediately  
**Related:** req:634cca15, req:7ab8c78d, brief-evaluator-backlog.md

## Problem
`writeSkippedEvaluations()` only skips evaluator/no-transcript sessions.
`findParentsWithUnevaluatedChildren()` only finds child sessions.
**Root sessions (99.99% of backlog) are invisible to both paths.**

## Solution
Add `writeHeuristicEvaluations()` to `src/lib/evaluator.ts` and call it from the handler.

---

## Change 1: Add to `src/lib/evaluator.ts` (after `writeSkippedEvaluations`)

```typescript
/**
 * Write heuristic (deterministic) evaluations for root sessions that have
 * transcripts but no parentSessionId. These sessions are invisible to the
 * task-tree evaluation path (evaluateTask) and would otherwise accumulate
 * as an ever-growing backlog.
 *
 * Scoring heuristic based on available metadata and transcript patterns:
 * - Session status (done vs error)
 * - Turn count and tool call count
 * - OpBudget exhaustion pattern
 * - finish() tool usage
 * - Session cost
 *
 * Returns the number of evaluation files written.
 */
export async function writeHeuristicEvaluations(persistDir: string): Promise<number> {
  const { mkdir, writeFile, readFile, access } = await import("node:fs/promises");
  const fileExists = async (p: string) => { try { await access(p); return true; } catch { return false; } };
  const evalDir = join(persistDir, "evaluations");
  await mkdir(evalDir, { recursive: true });

  const allSessions: Record<string, PersistedSession> = await loadAllSessionMetasAsync(persistDir);
  let written = 0;

  for (const [sessionId, session] of Object.entries(allSessions)) {
    // Only root sessions (no parent)
    if (session.parentSessionId) continue;

    // Skip if already evaluated
    const evalPath = join(evalDir, `${sessionId}.json`);
    if (await fileExists(evalPath)) continue;

    // Skip sessions still running
    if (session.status === "running" || session.status === "idle") continue;

    // Skip evaluator sessions (already handled by writeSkippedEvaluations)
    if (session.agent === "evaluator") continue;

    // Must have a transcript
    const activeJsonl = join(persistDir, "sessions", sessionId, "session.jsonl");
    const archivedJsonl = join(historyDir(persistDir), sessionId, "session.jsonl");
    const transcriptPath = await fileExists(activeJsonl) ? activeJsonl : 
                           await fileExists(archivedJsonl) ? archivedJsonl : null;
    if (!transcriptPath) continue;

    // Read transcript for heuristic analysis
    let transcriptText = "";
    try {
      transcriptText = await readFile(transcriptPath, "utf-8");
    } catch {
      continue; // Can't read → skip
    }

    // Compute heuristic scores
    const scores = computeHeuristicScores(session, transcriptText);

    const evaluation = {
      agent: session.agent,
      sessionId,
      efficiency: scores.efficiency,
      quality: scores.quality,
      productive_calls: scores.productiveCalls,
      wasted_calls: scores.wastedCalls,
      verdict: scores.verdict,
      issues: scores.issues,
      overall: {
        efficiency: scores.efficiency,
        quality: scores.quality,
        verdict: scores.verdict,
        result_delivered: scores.resultDelivered,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        cost: 0,
        turns: 0,
      },
      failureChains: [],
      evaluatedByHeuristic: true,
    };

    writeFileSync(evalPath, JSON.stringify(evaluation, null, 2), "utf-8");
    written++;
  }

  return written;
}

/**
 * Deterministic scoring based on session metadata and transcript patterns.
 */
function computeHeuristicScores(session: PersistedSession, transcript: string): {
  efficiency: number;
  quality: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: "good" | "acceptable" | "needs_improvement";
  issues: string[];
  resultDelivered: boolean;
} {
  let efficiency = 3;
  let quality = 3;
  let productiveCalls = 0;
  let wastedCalls = 0;
  const issues: string[] = [];

  // Count tool calls from transcript (each line starting with toolCall or containing tool_call)
  const toolCallMatches = transcript.match(/"type":"toolCall"/g);
  const toolResultMatches = transcript.match(/"type":"toolResult"/g);
  const totalToolCalls = toolCallMatches?.length ?? 0;
  const totalToolResults = toolResultMatches?.length ?? 0;

  // Count assistant turns
  const assistantTurns = (transcript.match(/"role":"assistant"/g) || []).length;

  // 1. Session status
  if (session.status === "error") {
    quality -= 1;
    issues.push("session_error");
  }

  // 2. OpBudget exhaustion
  const hasOpBudgetError = transcript.includes("opBudget") || transcript.includes("operation budget");
  if (hasOpBudgetError && session.status === "error") {
    efficiency -= 1;
    issues.push("opBudget_exhaustion");
  }

  // 3. Very shallow sessions (< 2 assistant turns with few tool calls)
  if (assistantTurns <= 1 && totalToolCalls === 0) {
    quality -= 2;
    issues.push("shallow_session");
  }

  // 4. finish() tool usage
  const hasFinishCall = transcript.includes('"finish"') || transcript.includes('"name":"finish"');
  if (hasFinishCall) {
    quality += 1; // Good completion practice
  } else if (session.status === "done" && assistantTurns > 2) {
    issues.push("no_finish_call");
  }

  // 5. Successful session with reasonable tool usage
  if (session.status === "done" && totalToolCalls >= 3) {
    efficiency += 1;
    quality += 1;
  }

  // 6. High tool call count with errors suggests wasteful retries
  const errorResults = (transcript.match(/P53 Violation|Error:|ENOENT|Cannot find/gi) || []).length;
  if (errorResults > 3) {
    efficiency -= 1;
    wastedCalls = Math.min(errorResults, totalToolCalls);
    issues.push("multiple_tool_errors");
  }

  productiveCalls = Math.max(0, totalToolCalls - wastedCalls);

  // Clamp scores to 1-5 range
  efficiency = Math.max(1, Math.min(5, efficiency));
  quality = Math.max(1, Math.min(5, quality));

  // Determine verdict
  let verdict: "good" | "acceptable" | "needs_improvement";
  if (quality >= 4 && efficiency >= 4) {
    verdict = "good";
  } else if (quality >= 2 && efficiency >= 2) {
    verdict = "acceptable";
  } else {
    verdict = "needs_improvement";
  }

  const resultDelivered = session.status === "done" && (hasFinishCall || totalToolCalls >= 2);

  return { efficiency, quality, productiveCalls, wastedCalls, verdict, issues, resultDelivered };
}
```

## Change 2: Wire into handler (`agents/may/handlers/evaluate-sessions.ts`)

Add import:
```typescript
import { evaluateTask, writeSkippedEvaluations, writeHeuristicEvaluations } from "../../../src/lib/evaluator.js";
```

In `handleEvaluateSessions()`, after `writeSkippedEvaluations()` and before `findParentsWithUnevaluatedChildren()`:

```typescript
  // Heuristic evaluation for root sessions (no parent)
  try {
    const heuristic = await writeHeuristicEvaluations(persistDir);
    if (heuristic > 0) onLog?.(`[eval] Wrote ${heuristic} heuristic evaluation(s) for root sessions`);
    result.skipped += heuristic; // Count in skipped bucket for reporting
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeHeuristicEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeHeuristicEvaluations failed: ${msg}`);
  }
```

## Expected Impact
- **Immediate:** Clears 10,113 backlog sessions in one cron run (~30 seconds)
- **Ongoing:** Each 30-min cron run processes new root sessions deterministically
- **Cost:** $0 (pure JS, no LLM calls)
- **Backlog growth:** Stops growing — converges to 0

## Test Plan
After implementation, verify:
1. `npx vitest run src/lib/evaluator` — existing tests still pass
2. Run the handler manually — should produce ~10K heuristic evaluations
3. Check `.state/evaluations/` — new files should have `evaluatedByHeuristic: true`
4. Re-run the backlog count script — should show 0 unevaluated root sessions
